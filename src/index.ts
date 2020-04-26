import {init} from "hap-nodejs";

import openems  from "./integrations/openems/init"

const { program } = require('commander');

program.parse(process.argv)

init()

openems()
