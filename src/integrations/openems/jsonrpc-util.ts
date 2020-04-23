import { JsonrpcResponseError, JsonrpcResponseSuccess, JsonrpcMessage, JsonrpcNotification, JsonrpcRequest } from "./jsonrpc/base";


var warn = require('debug')('openems:jsonrpc-util:warn')
var info = require('debug')('openems:jsonrpc-util:info')
var debug = require('debug')('openems:jsonrpc-util:debug')
const WebSocket = require('ws');

class NotificationHandler {
    constructor(
        public condition: (params: any) => boolean,
        public handle: (params: any) => void,
    ){}
}

export class JsonRPC {

    constructor(private url: string) {
    }

    private requests: Map<String, {resolve: (value?: any) => void, reject: (reason?: any) => void}> = new Map<String, {resolve: (value?: any) => void, reject: (reason?: any) => void}>()

    private handlers: Map<String, NotificationHandler[]> = new Map<String, NotificationHandler[]>()

    private ws: any


    public async open(): Promise<void> {
        // reset requests after possible re-connect
        this.requests = new Map<String, {resolve: (value?: any) => void, reject: (reason?: any) => void}>()
        this.ws = new WebSocket(this.url)
    
        this.ws.on('message', (data: any) => {
            debug('message received: ' + data)
            try {
                let response = JsonrpcMessage.from(JSON.parse(data))

                if (!!(response as JsonrpcResponseError).error) {
                    let re = response as JsonrpcResponseError
                    if (this.requests.has(re.id)) {
                        this.requests.get(re.id)!.reject(re.error)
                        this.requests.delete(re.id)
                        return
                    }
                    throw new Error('received json-rpc error-response with unknown id ' + re.id + ': ' + re.error)
                } else if (!!(response as JsonrpcResponseSuccess).result) {
                    let rs = response as JsonrpcResponseSuccess
                    if (this.requests.has(rs.id)) {
                        this.requests.get(rs.id)!.resolve(rs.result)
                        this.requests.delete(rs.id)
                        return
                    }
                    throw new Error('received json-rpc success-response with unknown id ' + rs.id + ': ' + rs.result)
                } else if (!!(response as JsonrpcNotification).method) {
                    let rn = response as JsonrpcNotification
                    if (this.handlers.has(rn.method)) {
                        this.handlers.get(rn.method)!.filter(nh => nh.condition(rn.params)).forEach(nh => nh.handle(rn.params))
                        return
                    } else {
                        warn('received notification of method ' + rn.method + ', but no handler was registered')
                        return
                    }
                } else {
                    throw new Error('received json-rpc message of unknown type: ' + data)
                }
            } catch (err) {
                this.ws.close()
                info('connection closed after an error was thrown')
                throw err
            }
        })

        return new Promise<void>((resolve, _reject) => {
            this.ws.on('open', () => {
                info('connection opened')
                resolve()
            })
        })
    }

    public close() {
        this.ws.close()
        info('connection closed')
    }

    public register(method: string, handler: (params: any) => void, condition: (params: any) => boolean = (params: any) => true) {
        if (!this.handlers.has(method)) {
            this.handlers.set(method, [new NotificationHandler(condition, handler)])
        } else {
            this.handlers.get(method)!.push(new NotificationHandler(condition, handler))
        }
    }

    public request(rq: JsonrpcRequest): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            this.requests.set(rq.id, {resolve: resolve, reject: reject})
            this.ws.send(JSON.stringify(rq))
        })
    }

    public call(method: string, params: any): Promise<any> {
        return this.request(new JsonrpcRequest(method, params))
    }
}