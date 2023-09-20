import { Pushover } from 'pushover-js';
import { envsafe, str, num } from 'envsafe';
import debug from 'debug';
import axios from 'axios';
import moment from 'moment';

// Api spec does not match prusa mini
// https://github.com/prusa3d/Prusa-Link-Web/blob/master/spec/openapi.yaml
// Endpoints reverse engineered from PrusaLink web interface

const log = debug('prusa-pushover');
log.enabled = true;

const env = envsafe({
    PUSHOVER_USER_KEY: str(),
    PUSHOVER_API_KEY: str(),
    PRUSA_IP: str(),
    PRUSA_API_KEY: str(),
    POLLING_INTERVAL: num({
        desc: 'How often to poll the printer for status (in ms)',
        default: 1000 * 5,
    }),
    INACTIVITY_TIMEOUT: num({
        default: 1000 * 60,
    })
});

const printer = `http://${env.PRUSA_IP}`
const api = axios.create({
    baseURL: printer,
    headers: {
        "X-Api-Key": env.PRUSA_API_KEY,
    }
});

const pushover = new Pushover(env.PUSHOVER_USER_KEY, env.PUSHOVER_API_KEY);

interface PrinterState {
    telemetry: {
        'temp-bed': number,
        'temp-nozzle': number,
        'print-speed': number,
        material: string,
    },
    temperature: {
        tool0: {
            actual: number,
            target: number,
            display: number,
            offset: number
        },
        bed: {
            actual: number,
            target: number,
            offset: number
        }
    },
    state: {
        text: string,
        flags: {
            operational: boolean,
            paused: boolean,
            printing: boolean,
            cancelling: boolean,
            pausing: boolean,
            sdReady: boolean,
            error: boolean,
            closedOnError: boolean,
            ready: boolean,
            busy: boolean
        }
    }
}

interface Job {
    state: string,
    job?: {
        estimatedPrintTime: number,
        file: {
            name: string,
            path: string,
            display: string,
        }
    },
    progress?: {
        completion: number,
        printTime: number,
        printTimeLeft: number,
    }
}

const state: {
    printerState: PrinterState | null,
    job: Job | null
} = {
    printerState: null,
    job: null
}

async function start() {
    log('Starting...');
    log(`Checking printer: ${env.PRUSA_IP} info...`);
    const response = await api.get('api/version');
    log(response.data);

    while (true) {
        await sleep(env.POLLING_INTERVAL);

        try {
            log(`Polling printer: ${env.PRUSA_IP}...`);
            const newState = (await api.get<PrinterState>('api/printer')).data;
            const newJob = (await api.get<Job>('api/job')).data;
            if (state.printerState === null) {
                log('First poll, skipping');
                state.printerState = newState;
                continue;
            }
            log(JSON.stringify(state, null, '    '));
            if (state.printerState.state.flags.printing && !newState.state.flags.printing) {
                log('Print finished!');
                const title = `Print finished!`;
                if (!state.job?.job) {
                    log('No job info');
                    const message = `Completed printing job.`;
                    await pushover.send(title, message);
                    continue;
                }
                const name = state.job.job.file.name;
                const elapsedTime = moment.duration(state.job.progress.printTime, 'seconds').humanize();;
                const message = `Completed printing ${name} after ${elapsedTime}.`;
                await pushover.send(title, message);
            }

            state.job = newJob;
            state.printerState = newState;
            if (!state.printerState.state.flags.printing) {
                log('Printer not printing, reducing polling frequency')
                await sleep(env.INACTIVITY_TIMEOUT);
            }
        } catch (e) {
            log(getErrorMessage(e));
        }
    }
}

start();

export function getErrorMessage(error: any) {
    if (error.response?.data?.message) {
        if (Array.isArray(error.response.data.message)) {
            return error.response.data.message.join(', ');
        }
        return error.response.data.message;
    }

    return error;
}

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}