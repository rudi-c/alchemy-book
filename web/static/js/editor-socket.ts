import { Channel, Socket } from "phoenix";

// Needed for testing conflicts when you only have one keyboard
const artificialDelay = 3 * 1000;

export default class EditorSocket {
    protected socket: Socket;
    protected channel: Channel;
    protected initCallback: (_) => void;
    protected changeCallback: (_) => void;

    constructor(protected documentId: string) {
        this.socket = new Socket("/socket", {
            logger: (kind, msg, data) => {
                console.log(`${kind}: ${msg}`, data);
            },
            params: {token: (window as any).userToken},
        });
    }

    public connect(initCallback: (_) => void,
                   changeCallback: (_) => void) {
        this.initCallback = initCallback;
        this.changeCallback = changeCallback;

        this.socket.connect();
        this.channel = this.socket.channel("documents:" + this.documentId);
        this.channel.join()
            .receive("ok", resp => console.log("joined"))
            .receive("error", reason => console.log("join failed ", reason));
        this.channel.on("init", this.initCallback);
        this.channel.on("change", this.changeCallback);
    }

    public sendChange(change: any, lamport: number) {
        setTimeout(() => {
            this.channel.push("change", {change, lamport})
              .receive("error", e => { throw e; });
        }, artificialDelay);
    }
}
