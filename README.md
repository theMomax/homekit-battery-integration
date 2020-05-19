# homekit-battery-integration
[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2FtheMomax%2Fhomekit-battery-integration.svg?type=shield)](https://app.fossa.io/projects/git%2Bgithub.com%2FtheMomax%2Fhomekit-battery-integration?ref=badge_shield)

A HomeKit integration for home batteries.

Sadly, Apple does not provide fitting `Services` and `Characteristics` for home batteries and energy management systems yet. However, integrating these systems with HomeKit does make a lot of sense, especially for usage in `Automations`. Thus, I decided to write an integration.

AFAIK, there only is one HomeKit integration for a home battery: [homebridge-tesla-powerwall](https://github.com/datMaffin/homebridge-tesla-powerwall). It uses Apple-defined services that do not exactly match their purpose. E.g. meters are represented as fans. Of course, this is kind of weird, especially when using it with Siri. That's why I decided to take the longer path and use custom `Services`.

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

## Features

I' currently working on an iOS app ([Home Batteries](https://github.com/theMomax/homekit-battery-frontend)) that offers a better overview for this project's custom services than the Eve App. It doesn't allow editing yet, but that can be done in the Home App. It still is a little buggy (I basically don't have any frontend-experience at all), but it is getting better. It is still lacking Siri support and a panel in the today view for real quick access, but this is not of top priority for me right now.

First, I want to add support for creating automations. Right now, this can be done in the [Eve App](https://apps.apple.com/de/app/elgato-eve/id917695792), however that one doesn't support smaller/higher triggers, but only equality. This does work well with things like state or battery level, but not with power values.

Sum Accessory ([Home Batteries](https://github.com/theMomax/homekit-battery-frontend))  |  Overview                   |  Bridge Information       |  Accessory Information    |  Sum Accessory ([Eve App](https://apps.apple.com/de/app/elgato-eve/id917695792))
:-------------------------:|:-------------------------:|:-------------------------:|:-------------------------:|:-------------------------:
![](https://user-images.githubusercontent.com/21169289/82332369-997eb580-99e5-11ea-957e-13f9328f9594.jpeg) | ![](https://user-images.githubusercontent.com/21169289/80403759-6d798400-88c0-11ea-8dc6-354f13243df2.PNG)  |  ![](https://user-images.githubusercontent.com/21169289/80403744-63f01c00-88c0-11ea-9429-b28ce9baa70a.PNG)  |  ![](https://user-images.githubusercontent.com/21169289/80403766-710d0b00-88c0-11ea-8eca-9609f0883ed6.PNG)  |  ![](https://user-images.githubusercontent.com/21169289/81083501-f57d1080-8ef4-11ea-8719-96d8643a5adb.jpeg)

## Integrations

OpenEMS is the only integration to date. I do not have access to any other system currently, however, I would be happy to accept PRs with other integrations!

### [OpenEMS](https://openems.io)

A list of supported hardware can he found [here](https://openems.io/openems-ready/).

#### Setup

Run `npm run start -- -oa <OpenEMS-IP>`. The program will automatically scan the configuration of your OpenEMS installation and create the according `Accessories`. Note that each `edge` is hosted as a separate `Bridge`. You can configure the OpenEMS password as well as the HomeKit pincode and port. Run `npm run start -- --help` for more information on that.

#### Supported Components

* `_sum` component: System State, Total Battery Level, Total Production, Consumption, Charge/Discharge, Grid Sell/Buy
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
Maximum Value   |  4
Unit   |  watt

## License
[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2FtheMomax%2Fhomekit-battery-integration.svg?type=large)](https://app.fossa.io/projects/git%2Bgithub.com%2FtheMomax%2Fhomekit-battery-integration?ref=badge_large)
