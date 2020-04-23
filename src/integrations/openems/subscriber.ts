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

var info = require('debug')('openems:subscriber:info')
var debug = require('debug')('openems:subscriber:debug')

class EdgeInfo {
  constructor(public edge: Edge, public configuration?: EdgeConfig) {
  }
}

export class Subscriber {

    constructor(private url: string, private password: string) {
    }

    private edges = new Map<String, EdgeInfo>()

    /**
     * subscribe to openems using json-rpc via websocket. All channels that pass
     * the filter are subscribed to. For every channel the consumer is called in
     * order to process the given value.
     */
    public async subscribe(filter: (edge: string, component: string, channel: string, channelInfo: EdgeConfig.ComponentChannel) => boolean, consume: (channelId: string, value: number | string) => void): Promise<String[]> {
      let subscribedChannels: String[] = []

      const jsonrpc = new JsonRPC(this.url);
 
      // ignore session auth failed notification
      jsonrpc.register(AuthenticateWithSessionIdFailedNotification.METHOD, () => {})

      await jsonrpc.open()

      let result = (await jsonrpc.request(new AuthenticateWithPasswordRequest({ password: this.password }))) as {
        token: string,
        edges: Edges
      }

      info(`${result.edges.length} edge(s) detected: ` + result.edges.map(e => e.id))

      for (const edge of result.edges) {
        if (this.edges.has(edge.id)) {
          continue
        }
        info('requesting config for edge ' + edge.id)
        let request = new EdgeRpcRequest({ 
          edgeId: edge.id,
          payload: new GetEdgeConfigRequest()
        })

        let ei = new EdgeInfo(edge)

        this.edges.set(edge.id, ei)

        let config = (await jsonrpc.request(request)).payload.result as EdgeConfig
        
        info('received config for edge ' + ei.edge.id)

        ei.configuration = new EdgeConfig(config)

        const channelsToSubscribe = Array.from(ei.configuration.getChannels()).map(v => {
          let channelPathComponents = v[0].split('/')
          if (channelPathComponents.length !== 2) {
            throw new Error('illegal channel address format: ' + v[0])
          }
          return {channelId: new ChannelAddress(channelPathComponents[0], channelPathComponents[1]), channelInfo: v[1]}
        }).filter(v => filter('edge' + ei.edge.id, v.channelId.componentId, v.channelId.channelId, v.channelInfo)).map(v => v.channelId)

        jsonrpc.register('edgeRpc', (params: any) => {
          let data = params.payload.params as { [channelAddress: string]: string | number }
          for (const channel in data) {
            consume('edge' + edge.id + '/' + channel, data[channel])
          }
        }, (params: any) => {
          return params.edgeId === String(edge.id) && params.payload.method === CurrentDataNotification.METHOD
        })
        
        info('requesting subscriptions for ' + channelsToSubscribe.length + ' channel(s) from edge' + ei.edge.id + ': ' + channelsToSubscribe.join(', '))
        await jsonrpc.request(new EdgeRpcRequest({edgeId: ei.edge.id, payload: new SubscribeChannelsRequest(channelsToSubscribe)}))
        subscribedChannels.push(...channelsToSubscribe.map(ca => 'edge' + edge.id + '/' + ca.toString()))
      }

      return subscribedChannels
    }

    public static CHANNELFILTER_SUM(): (edge: string, component: string, channel: string, channelInfo: EdgeConfig.ComponentChannel) => boolean {
      return (edge: string, component: string, channel: string, channelInfo: EdgeConfig.ComponentChannel) => { return component === '_sum'}
    }

    public static CHANNELFILTER_EXACTLY(edgeId: string, componentId: string, ...channelIds: string[]): (edge: string, component: string, channel: string, channelInfo: EdgeConfig.ComponentChannel) => boolean {
      return (edge: string, component: string, channel: string, channelInfo: EdgeConfig.ComponentChannel) => { 
        return edge === edgeId && component === componentId && channelIds.includes(channel)
      }
    }
}