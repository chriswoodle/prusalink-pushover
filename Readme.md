# PrusaLink + Pushover

Deliver push notifications when your print completes!

Supports:
* Original Prusa Mini+
* Pushover.net

# Setup

Create `.env` file with appropiate settings. You will need your printers [IP address and the API key.](https://help.prusa3d.com/guide/wi-fi-and-prusalink-setup-mini-_316781#319826)
Also [create a api key on Pushover.net](https://pushover.net/apps/build).

```
yarn install
yarn build
yarn start
```

## Advanced
You can configure the polling interval with `POLLING_INTERVAL` which defaults to `5000` ms.

If printer is in not priting state, the polling rate will be increased and extra `INACTIVITY_TIMEOUT` which defaults to 1 minute (`60000`ms)

# About
This application polls your printers http API and keeps track of the printer state. When the printer state goes from `printerState.state.flags.printing == true` to `printerState.state.flags.printing == false` it will deliver a push notification.