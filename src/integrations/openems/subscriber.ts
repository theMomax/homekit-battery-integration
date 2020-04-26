import { AuthenticateWithPasswordRequest } from "./jsonrpc/request/authenticateWithPasswordRequest";
import { Edge, Edges } from "./jsonrpc/shared";
import { EdgeRpcRequest } from "./jsonrpc/request/edgeRpcRequest";
import { GetEdgeConfigRequest } from "./jsonrpc/request/getEdgeConfigRequest";
import { EdgeConfig } from "./edge/edgeconfig";
import { AuthenticateWithSessionIdFailedNotification } from "./jsonrpc/notification/authenticatedWithSessionIdFailedNotification";
import { SubscribeChannelsRequest } from "./jsonrpc/request/subscribeChannelsRequest";
import { ChannelAddress } from "./type/channeladdress";
import { CurrentDataNotification } from "./jsonrpc/notification/currentDataNotification";
import { JsonRPC } from './jsonrpc-util'

var warn = require('debug')('openems:subscriber:warn')
var info = require('debug')('openems:subscriber:info')
var debug = require('debug')('openems:subscriber:debug')

class EdgeInfo {
  constructor(public edge: Edge, public configuration?: EdgeConfig) {
  }
}

export class Subscriber {

    constructor(private url: string, private password: string) {
      this.jsonrpc = new JsonRPC(this.url)
    }

    private jsonrpc: JsonRPC
    private edges = new Map<String, EdgeInfo>()
    private subscribedChannels: Map<String, Number> = new Map()

    /**
     * init must be called before using any other function of this class.
     */
    public async init(): Promise<void> {
      // ignore session auth failed notification
      this.jsonrpc.register(AuthenticateWithSessionIdFailedNotification.METHOD, () => {})

      await this.jsonrpc.open()

      let edges = await this.auth()
      for (const edge of edges) {
        this.edges.set(edge.id, await this.getConfigForEdge(edge))
      }
    }

    public getEdges(): string[] {
      return Array.from(this.edges.keys()).map(edgeId => 'edge' + edgeId)
    }

    public getEdgeConfig(edgeId: string): EdgeConfig | undefined {
      return this.edges.get(edgeId.replace('edge', ''))?.configuration
    }

    public getEdgeComponents(edgeId: string): string[] {
      const ei = this.edges.get(edgeId.replace('edge', ''))
      if (!ei) {
        return []
      }
      let components : string[] = []
      for (const c in ei.configuration!.components) {
        components.push(c)
      }
      return components
    }

    public getComponentChannels(edgeId: string, componentId: string): string[] {
      const ei = this.edges.get(edgeId.replace('edge', ''))
      if (!ei || !ei.configuration!.components[componentId]) {
        return []
      }
      let channels : string[] = []
      for (const c in ei.configuration!.components[componentId].channels) {
        channels.push(c.replace(componentId + '/', ''))
      }
      return channels
    }

    /**
     * subscribe to openems using json-rpc via websocket. All channels that pass
     * the filter are subscribed to. For every channel the consumer is called in
     * order to process the given value.
     */
    public async subscribe(filter: (edge: string, component: string, channel: string) => boolean, consume: (channelId: string, value: number | string) => void): Promise<String[]> {
      let newSubscriptions: String[] = []
      // for all edges do
      for (const ei of this.edges.values()) {
        // filter available channels using given filter-method
        const channelsToSubscribe = Array.from(ei.configuration!.getChannels()).map(v => {
          let channelPathComponents = v[0].split('/')
          if (channelPathComponents.length !== 2) {
            throw new Error('illegal channel address format: ' + v[0])
          }
          return {channelId: new ChannelAddress(channelPathComponents[0], channelPathComponents[1]), channelInfo: v[1]}
        }).filter(v => filter('edge' + ei.edge.id, v.channelId.componentId, v.channelId.channelId)).map(v => v.channelId)

        // register callback that is called each time a update on one of the channelsToSubscribe is received
        this.jsonrpc.register('edgeRpc', (params: any) => {
          let data = params.payload.params as { [channelAddress: string]: string | number }
          for (const channel in data) {
            let channelPathComponents = channel.split('/')
            if (filter('edge' + ei.edge.id, channelPathComponents[0], channelPathComponents[1])) {
              consume('edge' + ei.edge.id + '/' + channel, data[channel])
            }
          }
        }, (params: any) => {
          return params.edgeId === String(ei.edge.id) && params.payload.method === CurrentDataNotification.METHOD
        })
        
        // add subscriptions to this Subscriber's list of subscribed channels
        channelsToSubscribe.map(ca => 'edge' + ei.edge.id + '/' + ca.toString()).forEach(channelPath => {
          if (!this.subscribedChannels.has(channelPath)) {
            this.subscribedChannels.set(channelPath, 1)
          } else {
            this.subscribedChannels.set(channelPath, Number(this.subscribedChannels.get(channelPath)!) + 1)
          }
        })

        // request subscriptions: actually here we do not only subscribe to all the new ones, but to all that are present in the Subscriber's list of subscribed channels
        info('requesting subscription for ' + channelsToSubscribe.length + ' channel(s) from edge' + ei.edge.id + ': ' + channelsToSubscribe.join(', '))
        await this.jsonrpc.request(new EdgeRpcRequest({edgeId: ei.edge.id, payload: new SubscribeChannelsRequest(Array.from(this.subscribedChannels.keys()).map(a => {
          let channelPathComponents = a.split('/')
          return new ChannelAddress(channelPathComponents[1], channelPathComponents[2])
        }))}))
        
        newSubscriptions.push(...channelsToSubscribe.map(ca => 'edge' + ei.edge.id + '/' + ca.toString()))
      }

      return newSubscriptions
    }

    /**
     * unsubscribe from openems using json-rpc via websocket. All channels that
     * pass the filter are unsubscribed.
     */
    public async unsubscribe(filter: (edge: string, component: string, channel: string) => boolean): Promise<void> {
      // for all edges do
      for (const ei of this.edges.values()) {
        // filter available channels using given filter-method
        const channelsToSubscribe = Array.from(ei.configuration!.getChannels()).map(v => {
          let channelPathComponents = v[0].split('/')
          if (channelPathComponents.length !== 2) {
            throw new Error('illegal channel address format: ' + v[0])
          }
          return {channelId: new ChannelAddress(channelPathComponents[0], channelPathComponents[1]), channelInfo: v[1]}
        }).filter(v => filter('edge' + ei.edge.id, v.channelId.componentId, v.channelId.channelId)).map(v => v.channelId)
        
        // remove subscriptions from this Subscriber's list of subscribed channels
        channelsToSubscribe.map(ca => 'edge' + ei.edge.id + '/' + ca.toString()).forEach(channelPath => {
          if (!this.subscribedChannels.has(channelPath)) {
            return
          } else if (this.subscribedChannels.get(channelPath) === 1) {
            this.subscribedChannels.delete(channelPath)
          } else {
            this.subscribedChannels.set(channelPath, Number(this.subscribedChannels.get(channelPath)!) - 1)
          }
        })

        // request subscriptions: actually here we do not only subscribe to all the new ones, but to all that are present in the Subscriber's list of subscribed channels
        info('cancel subscription for ' + channelsToSubscribe.length + ' channel(s) at edge' + ei.edge.id + ': ' + channelsToSubscribe.join(', '))
        await this.jsonrpc.request(new EdgeRpcRequest({edgeId: ei.edge.id, payload: new SubscribeChannelsRequest(Array.from(this.subscribedChannels.keys()).map(a => {
          let channelPathComponents = a.split('/')
          return new ChannelAddress(channelPathComponents[1], channelPathComponents[2])
        }))}))
      }
    }

    /**
     * get values from openems using json-rpc via websocket. The returned map
     * contains values for all channels that pass the filter. This method is
     * realized by subscribing and unsubscribing from the according channels.
     * Do only use for one-time purposes and group calls if possible to increase
     * performance.
     */
    public async get(filter: (edge: string, component: string, channel: string) => boolean): Promise<Map<String, Number | String>> {
      return new Promise<Map<String, Number | String>>(async resolve => {
        let values = new Map<String, String | Number>()
        let count = 0
        let length = -1
        let done: boolean = false
        length = (await this.subscribe(filter, (channelId, value) => {
          if (!values.has(channelId)) {
            count++
          }
          values.set(channelId, value)
          if (count === length) {
            if (!done) {
              done = true
              this.unsubscribe(filter)
              resolve(values)
            }
          }
        })).length
      })
    }

    public static CHANNELFILTER_SUM(): (edgeId: string, componentId: string, channelId: string) => boolean {
      return (edge: string, component: string, channel: string) => { return component === '_sum'}
    }

    public static CHANNELFILTER_EXACTLY(edgeId: string, componentId: string, ...channelIds: string[]): (edge: string, component: string, channel: string) => boolean {
      return (edge: string, component: string, channel: string) => { 
        return edge === edgeId && component === componentId && channelIds.includes(channel)
      }
    }

    private async auth(): Promise<Edge[]> {
      let result = (await this.jsonrpc.request(new AuthenticateWithPasswordRequest({ password: this.password }))) as {
        token: string,
        edges: Edges
      }

      info(`${result.edges.length} edge(s) detected: ` + result.edges.map(e => 'edge' + e.id))
      return result.edges
    }

    private async getConfigForEdge(edge: Edge): Promise<EdgeInfo> {
      info('requesting config for edge' + edge.id)
      let request = new EdgeRpcRequest({ 
        edgeId: edge.id,
        payload: new GetEdgeConfigRequest()
      })

      let ei = new EdgeInfo(edge)

      this.edges.set(edge.id, ei)

      let config = (await this.jsonrpc.request(request)).payload.result as EdgeConfig
      
      info('received config for edge' + ei.edge.id)

      ei.configuration = new EdgeConfig(config)
      return ei
    }
}