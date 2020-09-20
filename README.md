# homekit-battery-integration
[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2FtheMomax%2Fhomekit-battery-integration.svg?type=shield)](https://app.fossa.io/projects/git%2Bgithub.com%2FtheMomax%2Fhomekit-battery-integration?ref=badge_shield)

A HomeKit integration for home batteries.

Sadly, Apple does not provide fitting `Services` and `Characteristics` for home batteries and energy management systems yet. However, integrating these systems with HomeKit does make a lot of sense, especially for usage in `Automations`. Thus, I decided to write an integration.

## Getting Started

### Development

* `git clone https://github.com/theMomax/homekit-battery-integration.git`
* `cd homekit-battery-integration`
* `npm install`
* `npm run build`
* `DEBUG="*" npm run start`

See [Integrations](#Integrations) for information on how to configure each integration.

### Install Release

* `npm i -g homekit-battery-integration`
* `DEBUG="*,-*:debug" homekit-battery-integration`

Again, see [Integrations](#Integrations) for information on how to configure each integration.

## App

I've started working on an iOS app ([Home Batteries](https://github.com/theMomax/home-batteries)) that offers an overview for this project's custom services. It also provides an UI for creating automations. Check out the link for more details. The [Eve App](https://apps.apple.com/de/app/elgato-eve/id917695792) also supports all of the custom Services/Characteristics defined below.

## Integrations

OpenEMS is the only integration to date. I do not have access to any other system currently, however, I would be happy to accept PRs with other integrations!

### [OpenEMS](https://openems.io)

A list of supported hardware can he found [here](https://openems.io/openems-ready/).

#### Setup

Run `npm run start -- -oa <OpenEMS-IP>`. The program will automatically scan the configuration of your OpenEMS installation and create the according `Accessories`. Note that each `edge` is hosted as a separate `Bridge`. You can configure the OpenEMS password as well as the HomeKit pincode and port. Run `npm run start -- --help` for more information on that.

#### Supported Components

* `_sum` component: System State, Total Battery Level, Total Production, Consumption, Charge/Discharge, Grid Sell/Buy, Excess := Sell+Charge
* all `ess` components: All installed batteries along with their current Charge/Discharge and State
* all `meter` components: All installed electricity meters along with their current active power and their State
* `_meta` component: OpenEMS Version from the is exposed in the `Bridge's` `AccessoryInformation`

## Custom HomeKit Services & Characteristics

### Services

#### ControllerService

Property                   |  Value
:-------------------------:|:-------------------------:
UUID  |  00000001-0000-1000-8000-0036AC324978
Required Characteristics  |  StatusFault
Optional Characteristics  |  Name

#### ElectricityMeterService

Property                   |  Value
:-------------------------:|:-------------------------:
UUID  |  00000002-0000-1000-8000-0036AC324978
Required Characteristics  |  CurrentPower
Optional Characteristics  |  CurrentPowerL1<br>CurrentPowerL2<br>CurrentPowerL3<br>Name<br>ElectricityMeterType

#### EnergyStorageService

Property                   |  Value
:-------------------------:|:-------------------------:
UUID  |  00000003-0000-1000-8000-0036AC324978
Required Characteristics  |  BatteryLevel<br>ChargingState<br>StatusLowBattery
Optional Characteristics  |  EnergyCapacity<br>Name

### Characteristics

#### CurrentPower

Property                   |  Value
:-------------------------:|:-------------------------:
UUID  |  00000001-0001-1000-8000-0036AC324978
Permissions  |  Paired Read, Notify
Format  |  float
Unit   |  watt

#### CurrentPowerL1

Property                   |  Value
:-------------------------:|:-------------------------:
UUID  |  00000002-0001-1000-8000-0036AC324978
Permissions  |  Paired Read, Notify
Format  |  float
Unit   |  watt

#### CurrentPowerL2

Property                   |  Value
:-------------------------:|:-------------------------:
UUID  |  00000003-0001-1000-8000-0036AC324978
Permissions  |  Paired Read, Notify
Format  |  float
Unit   |  watt

#### CurrentPowerL3

Property                   |  Value
:-------------------------:|:-------------------------:
UUID  |  00000004-0001-1000-8000-0036AC324978
Permissions  |  Paired Read, Notify
Format  |  float
Unit   |  watt

#### EnergyCapacity

Property                   |  Value
:-------------------------:|:-------------------------:
UUID  |  00000005-0001-1000-8000-0036AC324978
Permissions  |  Paired Read, Notify
Format  |  float
Minimum Value   |  0
Unit   |  kilowatthours

#### ElectricityMeterType

This characteristic helps the frontend to provide a more suitable
visualization for the meter. Implementations should conform to the following
rules:
 1. A meter without this type characteristic is assumed to be of type OTHER
 2. The meaning of a positive/negative CurrentPower depends on the type:
     - PRODUCTION, CONSUMPTION, OTHER: a positive value has a good
       connotation for the user
     - STORAGE, GRID: a negative value has a bad connotation for the user
    E.g.: A negative current power at the mains connection means the user is
    currently selling energy and thus earning money, which is considered 
    positive.

Property                   |  Value
:-------------------------:|:-------------------------:
UUID  |  00000006-0001-1000-8000-0036AC324978
Permissions  |  Paired Read
Format  |  uint8
Minimum Value   |  0
Maximum Value   |  5
Valid Values | 0 "other" <br> 1 "production" <br> 2 "consumption" <br> 3 "storage" <br> 4 "grid" <br> 5 "excess"

## License
[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2FtheMomax%2Fhomekit-battery-integration.svg?type=large)](https://app.fossa.io/projects/git%2Bgithub.com%2FtheMomax%2Fhomekit-battery-integration?ref=badge_large)
