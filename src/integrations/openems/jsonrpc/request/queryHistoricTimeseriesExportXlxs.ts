import { format } from 'date-fns';
import { JsonRpcUtils } from '../jsonrpcutils';
import { ChannelAddress } from '../../shared';
import { JsonrpcRequest } from '../base';

/**
 * Queries historic timeseries data; exports to Xlsx (Excel) file.
 * 
 * <pre>
 * {
 *   "jsonrpc": "2.0",
 *   "id": "UUID",
 *   "method": "queryHistoricTimeseriesExportXlxs",
 *   "params": {
 *     "timezone": Number,
 *     "fromDate": YYYY-MM-DD,
 *     "toDate": YYYY-MM-DD,
 *     "dataChannels": ChannelAddress[],
 *     "energyChannels": ChannelAddress[]
 *     }
 * }
 * </pre>
 */
export class QueryHistoricTimeseriesExportXlxsRequest extends JsonrpcRequest {

    static METHOD: string = "queryHistoricTimeseriesExportXlxs";

    public constructor(
        private fromDate: Date,
        private toDate: Date,
        private dataChannels: ChannelAddress[],
        private energyChannels: ChannelAddress[]
    ) {
        super(QueryHistoricTimeseriesExportXlxsRequest.METHOD, {
            timezone: new Date().getTimezoneOffset() * 60,
            fromDate: format(fromDate, 'yyyy-MM-dd'),
            toDate: format(toDate, 'yyyy-MM-dd'),
            dataChannels: JsonRpcUtils.channelsToStringArray(dataChannels),
            energyChannels: JsonRpcUtils.channelsToStringArray(energyChannels),
        });
        // delete local fields, otherwise they are sent with the JSON-RPC Request
        delete this.fromDate;
        delete this.toDate;
        delete this.dataChannels;
        delete this.energyChannels;
    }

}