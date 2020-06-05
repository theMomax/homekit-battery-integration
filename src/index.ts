import {HAPStorage} from "hap-nodejs/dist/lib/model/HAPStorage"
import path from "path"

import openems  from "./integrations/openems/init"

const { program } = require('commander');

program
    .option('-s, --storage-path <path>', "path to HAP-nodejs' persistence folder", './persist')

program.parse(process.argv)

HAPStorage.setCustomStoragePath(path.resolve(program.storagePath))

openems()
