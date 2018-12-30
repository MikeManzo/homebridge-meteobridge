# homebridge-meteobridge
A pretty basic plugin for Homebridge to display Temperature and Humidity for [meteobridge-](https://www.meteobridge.com/wiki/index.php/Home)connected weatherstations.  Currenlty the plugin relies on your locally-connected meteobridge to relay and display weather station data (temperature and humidity) to the Home App.

**Special Note:** As with most things in HomeKit, you can ask Siri on your iOS (or HomePod) device to read out the temp and/or humidity based on how you setup your devices in the Home App.

## Quick Installation

1. Install homebridge using: **_npm install -g homebridge_**
2. Install this plugin using: **_npm install -g homebridge-meteobridge_**
3. Update your configuration file to reflect your local conditions (**see the sample below**)

No keys or APIs required.  We just rely on the fact that **(a)** you have a weather station on your local networtk connected through a Meteobridge and **(b)** Meteobridge exposes templates for us to take advantage of.  

## Meteobridge References
1. [Meteobridge Templates](https://www.meteobridge.com/wiki/index.php/Templates)
2. [Meteobridge Add-On Services](https://www.meteobridge.com/wiki/index.php/Add-On_Services)


## Sample Configuration
Add the following information to your config.json file (without the <-- comments)
```
"accessories": [
    {
      "accessory": "HomeMeteobridge",
      "name": "Meteobridge",
      "ip_address":  "A.B.C.D",
      "frequency": 5000,
      "password": "<password>",
      "debug": "true"
    }
]
```
### Field Explainations
    "accessory": "HomeMeteobridge", <-- Our Accessory name
    "name": "Meteobridge",          <-- Easy to remember name
    "ip_address":  "A.B.C.D",       <-- IP address of our meteobridge
    "frequency": 5000,              <-- Update frequency (5 second min)
    "password": "<password>",       <-- Admin password for Meteobridge
    "debug": "true"                 <-- Display readings in the console

#### Things yet to do:
1. Add support for other sensors like wind, rain, etc ...
2. Add support for forecasts ...
3. ??  Any ideas ??

#### Credits
This plugin was heavily influenced by the Thorsten Voß's [homebridge-wunderground](https://github.com/xfjx/homebridge-wunderground) work.  With Wunderground likely becoming inaccessible as a free service in teh not-so-distant future, I chose to make this "local" version for people to use (if they have a Meteobridge-connected weather station, of course).