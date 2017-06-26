import * as net from 'net';
import * as tls from 'tls';
import * as url from 'url';

import { Observable } from 'rxjs/Observable';
import { ReplaySubject } from 'rxjs/ReplaySubject';

import { Connection } from './connection';
import { Event } from './event';
import { Protocol } from './protocol';

export class Server extends ReplaySubject<Event.Server> {
  private server: net.Server | tls.Server | null = null;
  private connections: Connection[];

  constructor(private hostUrl: url.Url, private options: any = {}) {
    super();

    this.connections = [];
  }

  public start() {
    const protocol = this.hostUrl.protocol;
    this.next(new Event.Starting());

    switch (protocol) {
      case Protocol.TELNET:
        this.server = this.serverNoTls(this.hostUrl);
        break;
      case Protocol.TELNETS:
        this.server = this.serverTls(this.hostUrl);
        break;
    }

    if (!this.server) {
      throw new Error('No hostUrl protocol has been supplied.');
    }

    this.server.on('error', (error: any) => {
      this.error(error);
    });

    this.server.listen(Number(this.hostUrl.port), this.hostUrl.hostname, 5, () => {
      this.next(new Event.Started());
    });

    return this.server;
  }

  public stop() {
    if (!this.server) {
      return;
    }

    this.next(new Event.Ending());

    if (this.connections) {
      this.connections.forEach((connection) => {
        connection.disconnect();
      });
    }

    this.server.close(() => {
      this.next(new Event.Ended());
    });
  }

  private serverNoTls(hostUrl: url.Url) {
    return net.createServer({ ...this.options }, (conn: net.Socket) => {
      const connection = new Connection({ connection: conn });
      conn.on('end', () => {
        this.next(new Event.Disconnected(connection));
      });
      this.next(new Event.Connected(connection));
    });
  }

  private serverTls(hostUrl: url.Url) {
    return tls.createServer({ ...this.options }, (conn: tls.TLSSocket) => {
      const connection = new Connection({ connection: conn });
      conn.on('end', () => {
        this.next(new Event.Disconnected(connection));
      });
      this.next(new Event.Connected(connection));
    });
  }
}