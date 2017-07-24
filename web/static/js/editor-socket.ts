import { Channel, Socket } from "phoenix";

// Needed for testing conflicts when you only have one keyboard
const artificialDelay = 3 * 1000;

export default class EditorSocket {
  private socket: Socket;
  private channel: Channel;

  constructor(private documentId: string,
              private initCallback: (any) => void,
              private changeCallback: (any) => void) {
    this.socket = new Socket("/socket", {
      params: {token: (window as any).userToken},
      logger: (kind, msg, data) => {
        //console.log(`${kind}: ${msg}`, data)
      },
    });
  }

  public connect = () => {
    this.socket.connect();
    this.channel = this.socket.channel("documents:" + this.documentId);
    this.channel.join()
      .receive("ok", resp => console.log("joined"))
      .receive("error", reason => console.log("join failed ", reason));
    this.channel.on("init", this.initCallback);
    this.channel.on("change", this.changeCallback);
  }

  public sendChange(change, lamport) {
    setTimeout(() => {
      this.channel.push("change", {change, lamport})
        .receive("error", e => { throw e; });
    }, artificialDelay);
  }
}
