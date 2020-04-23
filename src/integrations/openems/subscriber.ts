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
    private subscribedChannels: String[] = []

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
      for (const ei of this.edges.values()) {
        const channelsToSubscribe = Array.from(ei.configuration!.getChannels()).map(v => {
          let channelPathComponents = v[0].split('/')
          if (channelPathComponents.length !== 2) {
            throw new Error('illegal channel address format: ' + v[0])
          }
          return {channelId: new ChannelAddress(channelPathComponents[0], channelPathComponents[1]), channelInfo: v[1]}
        }).filter(v => filter('edge' + ei.edge.id, v.channelId.componentId, v.channelId.channelId)).map(v => v.channelId)

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
        
        info('additionally requesting subscriptions for ' + channelsToSubscribe.length + ' channel(s) from edge' + ei.edge.id + ': ' + channelsToSubscribe.join(', '))
        this.subscribedChannels.push(...channelsToSubscribe.map(ca => 'edge' + ei.edge.id + '/' + ca.toString()))
        await this.jsonrpc.request(new EdgeRpcRequest({edgeId: ei.edge.id, payload: new SubscribeChannelsRequest(this.subscribedChannels.map(a => {
          let channelPathComponents = a.split('/')
          return new ChannelAddress(channelPathComponents[1], channelPathComponents[2])
        }))}))
      }

      return this.subscribedChannels
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