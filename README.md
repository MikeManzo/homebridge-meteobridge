# homebridge-meteohub
A pretty basic plugin for Homebridge to display Temperature and Humidity for [meteohub-](https://wiki.meteohub.de/Main_Page)connected weatherstations.  Currenlty the plugin relies on your locally-connected meteohub to relay and display weather station data (temperature and humidity) to the Home App.

**Special Note:** As with most things in HomeKit, you can ask Siri on your iOS (or HomePod) device to read out the temp and/or humidity based on how you setup your devices in the Home App.

## Quick Installation

1. Install homebridge using: **_npm install -g homebridge_**
2. Install this plugin using: **_npm install -g homebridge-meteohub_**
3. Update your configuration file to reflect your local conditions (**see the sample below**)

No keys, or APIs required.  We just rely on the fact that **(a)** You have a weather station on your local network connected through a Meteohub and **(b)** Meteohub exposes templates for us to take advantage of.

All you need is the IP address and admin password (**_currenlty not used_**) for your Meteohub. (**_Note: The admin password is only used to make the local HTTP 'GET' calls._**)

## Meteohub References
1. [Meteohub User's Guide](http://www.meteohub.de/files/meteohub-v4.7en.pdf)
2. [Meteohub Data Logger Guide](http://www.meteohub.de/files/HTTP-Data-Logging-Protocol-v1.5.pdf)

## Sample Configuration
Add the following information to your config.json file:
```
"accessories": [
  {
    "accessory": "HomeMeteohub",            <-- Our Accessory name
    "name": "Meteohub",                     <-- Easy to remember name
    "ip_address":  "A.B.C.D",               <-- IP address of our meteohub  <pick IP OR server; leave the other empty --> "">
    "server_address: "your.domain.name"     <-- MeteoHub server FQ address  <pick server OR IP; leave the other empty --> "">
    "port": "1234"                          <-- Desired Port
    "frequency": 5000,                      <-- Update frequency (5 second min)
    "password": "<password>",               <-- Admin password for Meteohub <Currently NOT used>
    "debug": "true"                         <-- Display temp/humidity readings in the console
    }
]

```
### Field Explainations
    "accessory": "HomeMeteohub",            <-- Our Accessory name
    "name": "Meteohub",                     <-- Easy to remember name
    "ip_address":  "A.B.C.D",               <-- IP address of our meteobridge
    "server_address: "your.domain.name"     <-- MeteoHub server FQ address  <pick server OR IP; leave the other empty --> "">
    "port": "1234"                          <-- Desired Port
    "frequency": 5000,                      <-- Update frequency (5 second min)
    "password": "<password>",               <-- Admin password for Meteohub <Currently NOT used>
    "debug": "true"                         <-- Display temp/humidity readings in the console

#### Things yet to do:
- [ ] Add support for other sensors exposed by Meteohub
- [ ] Add support for user-defined units
- [ ] Add support for forecasted temperatures based on the Lat/Lon found in Meteobridge.
- [ ] Add support for password protected access to meteohub

#### Credits
This plugin was heavily influenced by the [Thorsten Voß's](https://github.com/xfjx) plugin:[homebridge-wunderground](https://github.com/xfjx/homebridge-wunderground).  With Wunderground likely becoming inaccessible as a free service in the not-so-distant future, I chose to make this "local" version for people to use (if they have a Meteobridge-connected weather station, of course).

This plugin is a very-close cousin to my [homebridge-meteobridge](https://github.com/MikeManzo/homebridge-meteobridge) plugin.  If you have a meteobridge device, check it out.