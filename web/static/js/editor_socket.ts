import { Channel, Presence, Socket } from "phoenix";

// Needed for testing conflicts when you only have one keyboard
const artificialDelay = 0 * 1000;

export interface UserPresence {
    color: string;
    cursor: { line: number, ch: number };
    onlineAt: number;
    siteId: number;
    userId: number;
    username: string;
}

export class EditorSocket {
    protected socket: Socket;
    protected channel: Channel;
    protected initCallback: (_) => void;
    protected changeCallback: (_) => void;
    protected presences: any;

    constructor(protected documentId: string,
                protected presenceCallback: (_) => void,
                protected disconnectCallback: () => void) {
        this.socket = new Socket("/socket", {
            logger: (kind, msg, data) => {
                // console.log(`${kind}: ${msg}`, data);
            },
            params: {token: (window as any).userToken},
        });
        this.presences = {};
    }

    public connect(initCallback: (_) => void,
                   changeCallback: (_) => void,
                   ) {
        this.initCallback = initCallback;
        this.changeCallback = changeCallback;

        this.socket.connect();
        this.channel = this.socket.channel("documents:" + this.documentId);
        this.channel.join()
            .receive("ok", resp => console.log("joined"))
            .receive("error", reason => console.log("join failed ", reason));
        this.channel.on("init", this.initCallback);
        this.channel.on("change", this.changeCallback);
        this.channel.on("presence_state", state => {
            this.presences = Presence.syncState(this.presences, state);
            this.presenceCallback(Presence.list(this.presences, this.listPresenceBy));
        });
        this.channel.on("presence_diff", diff => {
            this.presences = Presence.syncDiff(this.presences, diff);
            this.presenceCallback(Presence.list(this.presences, this.listPresenceBy));
        });

        this.channel.onClose(this.disconnectCallback);
        this.socket.onClose(this.disconnectCallback);
    }

    public sendChange(change: any, lamport: number): void {
        setTimeout(() => {
            this.channel.push("change", {change, lamport})
              .receive("error", e => { throw e; });
        }, artificialDelay);
    }

    public sendCursor(cursor: any): void {
        setTimeout(() => {
            this.channel.push("cursor", cursor)
              .receive("error", e => { throw e; });
        }, artificialDelay);
    }

    private listPresenceBy(siteId, {metas: metas}): UserPresence {
        return {
            color: metas[0].color,
            cursor: metas[0].cursor,
            onlineAt: metas[0].online_at,
            siteId: parseInt(siteId, 10),
            userId: metas[0].user_id,
            username: metas[0].username,
        };
    }
}
