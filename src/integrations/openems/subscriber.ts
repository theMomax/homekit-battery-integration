import { AuthenticateWithPasswordRequest } from "./jsonrpc/request/authenticateWithPasswordRequest";
import { AuthenticateWithPasswordResponse } from "./jsonrpc/response/authenticateWithPasswordResponse";
import { JsonrpcResponseError, JsonrpcResponseSuccess, JsonrpcMessage, JsonrpcNotification } from "./jsonrpc/base";
import { Edge } from "./jsonrpc/shared";
import { EdgeRpcRequest } from "./jsonrpc/request/edgeRpcRequest";
import { GetEdgeConfigRequest } from "./jsonrpc/request/getEdgeConfigRequest";
import { EdgeRpcResponse } from "./jsonrpc/response/edgeRpcResponse";
import { GetEdgeConfigResponse } from "./jsonrpc/response/getEdgeConfigResponse";
import { EdgeConfig } from "./edge/edgeconfig";
import { AuthenticateWithSessionIdFailedNotification } from "./jsonrpc/notification/authenticatedWithSessionIdFailedNotification";
import { SubscribeChannelsRequest } from "./jsonrpc/request/subscribeChannelsRequest";
import { ChannelAddress } from "./type/channeladdress";
import { EdgeRpcNotification } from "./jsonrpc/notification/edgeRpcNotification";
import { CurrentDataNotification } from "./jsonrpc/notification/currentDataNotification";

var info = require('debug')('openems:subscriber:info')
var debug = require('debug')('openems:subscriber:debug')
const WebSocket = require('ws');

class EdgeInfo {
  constructor(public edge: Edge, public configRequestId: string,  public configuration?: EdgeConfig) {
  }
}

export class Subscriber {

    constructor(private url: string, private password: string) {
    }

    /**
     * subscribe to openems using json-rpc via websocket. All channels that pass
     * the filter are subscribed to. For every channel the consumer is called in
     * order to process the given value.
     */
    public subscribe(filter: (edge: string, component: string, channel: string, channelInfo: EdgeConfig.ComponentChannel) => boolean, consume: (channelId: string, value: number | string) => void) {
      const ws = new WebSocket(this.url);

      let edges = new Map<String, EdgeInfo>()
 
      ws.on('open', () => {
        debug('socked opened')
        this.authenticate(ws)
      });
      
      ws.on('message', (data) => {
        debug('message received: ' + data)
        
        try {
          let response = JsonrpcMessage.from(JSON.parse(data))
          if ((response as AuthenticateWithSessionIdFailedNotification).method === AuthenticateWithSessionIdFailedNotification.METHOD) {
            // ignore
          } else if (!!(response as JsonrpcResponseError).error) {
            ws.close()
            throw (response as JsonrpcResponseError).error
          } else if (!!(response as JsonrpcResponseSuccess).result) {
            if (!!(response as AuthenticateWithPasswordResponse).result.edges) {
              this.requestAllConfigs(ws, response as AuthenticateWithPasswordResponse, edges)
            } else if (!!(((response as EdgeRpcResponse).result) as any).payload) {
              let responseId = (response as EdgeRpcResponse).id
              let edgeResponse = ((response as EdgeRpcResponse).result as any).payload

              if (!!(edgeResponse as JsonrpcResponseError).error) {
                ws.close()
                throw (edgeResponse as JsonrpcResponseError).error
              } else if (!!(edgeResponse as JsonrpcResponseSuccess).result) {

                if (!!(edgeResponse as GetEdgeConfigResponse).result.components) {
                  this.receiveConfig(ws, responseId, (edgeResponse as GetEdgeConfigResponse), edges, filter)
                }

              } else {
                ws.close()
                throw new Error('terminated subscription due to unrecognized response')
              }

            }

          } else if (!!(response as JsonrpcNotification).params) {
            if (!!(response as EdgeRpcNotification).params.edgeId) {
              let edgeId = (response as EdgeRpcNotification).params.edgeId
              let edgeResponse = (response as EdgeRpcNotification).params.payload
              if (!!(edgeResponse.method === CurrentDataNotification.METHOD)) {
                const channels = (edgeResponse as CurrentDataNotification).params
                for (const channelId in channels) {
                  consume('edge' + edgeId + '/' + channelId, channels[channelId])
                }
              }
            }
          } else {
            ws.close()
            throw new Error('terminated subscription due to unrecognized response')     
          }
        } catch (err) {
          ws.close()
          throw err
        }
      });

      info("registered subscriber")
    }

    public static CHANNELFILTER_SUM(edge: string, component: string, channel: string, channelInfo: EdgeConfig.ComponentChannel): boolean {
      return component === '_sum'
    }

    private authenticate(ws: any) {
      let request = JSON.stringify(new AuthenticateWithPasswordRequest({ password: this.password }))
        ws.send(request)
    }

    private requestAllConfigs(ws: any, response: AuthenticateWithPasswordResponse, edges: Map<String, EdgeInfo>) {
      const r = response.result
      info(`${r.edges.length} edge(s) detected: ` + r.edges.map(e => e.id))

      for (const edge of r.edges) {
        info('requesting config for edge ' + edge.id)
        let request = new EdgeRpcRequest({ 
          edgeId: edge.id,
          payload: new GetEdgeConfigRequest()
        })
        edges.set(edge.id, new EdgeInfo(edge, request.id))

        ws.send(JSON.stringify(request))
      }
    }

    private receiveConfig(ws: any, parentResponseId: string, response: GetEdgeConfigResponse, edges: Map<String, EdgeInfo>, filter: (edge: string, component: string, channel: string, channelInfo: EdgeConfig.ComponentChannel) => boolean) {
      const edgeCandidates: EdgeInfo[] = Array.from(edges).map(entry => entry[1]).filter(e => e.configRequestId === parentResponseId)
      if (edgeCandidates.length !== 1) {
        throw new Error('the received configuration could not be matched to an edge device')
      }
      const ei: EdgeInfo = edgeCandidates[0]
      
      info('received config for edge ' + ei.edge.id)

      if (!!ei.configuration) {
        throw new Error('the received configuration is related to an edge device that already has a configuration registered')
      }

      ei.configuration = new EdgeConfig(response.result)

      const channelsToSubscribe = Array.from(ei.configuration.getChannels()).map(v => {
        let channelPathComponents = v[0].split('/')
        if (channelPathComponents.length !== 2) {
          throw new Error('illegal channel address format: ' + v[0])
        }
        return {channelId: new ChannelAddress(channelPathComponents[0], channelPathComponents[1]), channelInfo: v[1]}
      }).filter(v => filter('edge' + ei.edge.id, v.channelId.componentId, v.channelId.channelId, v.channelInfo)).map(v => v.channelId)

      info('requesting subscriptions for ' + channelsToSubscribe.length + ' channel(s) from edge' + ei.edge.id + ': ' + channelsToSubscribe.join(', '))
      ws.send(JSON.stringify(new EdgeRpcRequest({edgeId: ei.edge.id, payload: new SubscribeChannelsRequest(channelsToSubscribe)})))
    }

}