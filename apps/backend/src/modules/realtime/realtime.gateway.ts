import type { ClientEvents, ServerEventName, ServerEvents } from '@lista/contracts';
import { Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { createAdapter } from '@socket.io/redis-adapter';
import type Redis from 'ioredis';
import { Repository } from 'typeorm';
import { Server, Socket } from 'socket.io';
import { ListMember } from '../../database/entities';
import { JwtPayload } from '../../common/types';
import { REDIS_CLIENT, REDIS_SUBSCRIBER } from '../../redis/redis.constants';
import { AuthStateService } from '../../redis/auth-state.service';
import configuration from '../../config/configuration';
import { listRoom, RT, userRoom } from './realtime.events';

interface AuthedSocket extends Socket {
  userId?: string;
  email?: string;
  sessionVersion?: number;
  expiresAt?: number;
  expiryTimer?: ReturnType<typeof setTimeout>;
}

/**
 * Gateway de tiempo real.
 *
 * Cada cliente entra a la sala `user:<id>` (notificaciones personales) y a una
 * sala `list:<id>` por cada lista de la que forma parte. Cuando alguien marca un
 * producto como comprado, el resto de integrantes lo ve al instante.
 *
 * El adaptador de Redis permite escalar el backend a varias réplicas sin perder
 * eventos entre ellas.
 */
/** Mismos orígenes que la API REST (CORS_ORIGINS); sin cabecera Origin = app nativa */
const allowOrigin = (origin: string | undefined, callback: (err: Error | null, ok?: boolean) => void) => {
  const origins = configuration().corsOrigins;
  callback(null, !origin || origins.includes(origin) || origins.includes('*'));
};

@WebSocketGateway({
  cors: { origin: allowOrigin, credentials: true },
  transports: ['websocket', 'polling'],
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @InjectRepository(ListMember) private readonly members: Repository<ListMember>,
    @Inject(REDIS_CLIENT) private readonly pub: Redis,
    @Inject(REDIS_SUBSCRIBER) private readonly sub: Redis,
    private readonly authState: AuthStateService,
  ) {}

  afterInit(server: Server): void {
    try {
      server.adapter(createAdapter(this.pub.duplicate(), this.sub.duplicate()));
      this.logger.log('Socket.IO enlazado al adaptador de Redis');
    } catch (error) {
      this.logger.warn(`No se pudo enlazar el adaptador de Redis: ${(error as Error).message}`);
    }

    // La autenticación se resuelve ANTES de aceptar la conexión, para que el
    // cliente reciba un `connect_error` claro en vez de una desconexión seca.
    server.use(async (socket, next) => {
      const token = this.extractToken(socket as Socket);
      if (!token) return next(new Error('Falta el token de acceso'));
      try {
        const payload = await this.jwt.verifyAsync<JwtPayload>(token, {
          secret: this.config.get<string>('jwt.accessSecret'),
        });
        if (!payload.exp) return next(new Error('Falta la caducidad del token'));
        if (payload.type !== 'access') return next(new Error('Tipo de token inválido'));
        if (!(await this.authState.isTokenAllowed(payload.sub, payload.sv))) {
          return next(new Error('La sesión ya no es válida'));
        }
        const authed = socket as AuthedSocket;
        authed.userId = payload.sub;
        authed.email = payload.email;
        authed.sessionVersion = payload.sv;
        authed.expiresAt = payload.exp * 1000;
        return next();
      } catch {
        return next(new Error('Token inválido o expirado'));
      }
    });
  }

  private extractToken(client: Socket): string | undefined {
    const auth = client.handshake.auth as Record<string, string> | undefined;
    if (auth?.token) return String(auth.token).replace(/^Bearer\s+/i, '');
    const header = client.handshake.headers?.authorization;
    if (header) return String(header).replace(/^Bearer\s+/i, '');
    // No se acepta en la query (`?token=`): acabaría en los logs de acceso de nginx y del proxy
    return undefined;
  }

  async handleConnection(client: AuthedSocket): Promise<void> {
    // El middleware de `afterInit` ya validó el token y dejó el userId puesto
    if (!client.userId) {
      client.disconnect(true);
      return;
    }

    if (!client.expiresAt || client.expiresAt <= Date.now()) { client.disconnect(true); return; }
    client.expiryTimer = setTimeout(() => {
      client.emit('session:expired');
      // Transport close lets older Socket.IO clients retry with their current token.
      client.conn.close(true);
    }, Math.min(client.expiresAt - Date.now(), 2147483647));
    client.expiryTimer.unref();
    await client.join(userRoom(client.userId));

    const memberships = await this.members.find({
      where: { userId: client.userId },
      select: { id: true, listId: true },
    });
    await Promise.all(memberships.map((m) => client.join(listRoom(m.listId))));

    client.emit('connected', {
      userId: client.userId,
      lists: memberships.map((m) => m.listId),
      serverTime: new Date().toISOString(),
    } satisfies ServerEvents['connected']);
    this.logger.debug(`Conectado ${client.email} (${memberships.length} listas)`);
  }

  handleDisconnect(client: AuthedSocket): void {
    if (client.expiryTimer) clearTimeout(client.expiryTimer);
    if (client.userId) this.logger.debug(`Desconectado ${client.email ?? client.userId}`);
  }

  @SubscribeMessage(RT.JOIN)
  async onJoin(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: ClientEvents['list:join'],
  ): Promise<{ ok: boolean; listId?: string; error?: string }> {
    if (!client.userId || !client.expiresAt || client.expiresAt <= Date.now() ||
      !(await this.authState.isTokenAllowed(client.userId, client.sessionVersion))) {
      client.disconnect(true); return { ok: false, error: 'Sesión expirada' };
    }
    if (!body?.listId || !/^[0-9a-f-]{36}$/i.test(body.listId)) return { ok: false, error: 'Petición inválida' };
    const member = await this.members.findOne({
      where: { listId: body.listId, userId: client.userId },
    });
    if (!member) return { ok: false, error: 'No perteneces a esta lista' };
    await client.join(listRoom(body.listId));
    client.to(listRoom(body.listId)).emit(RT.PRESENCE, {
      listId: body.listId,
      userId: client.userId,
      status: 'online',
    } satisfies ServerEvents['list:presence']);
    return { ok: true, listId: body.listId };
  }

  @SubscribeMessage(RT.LEAVE)
  async onLeave(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: ClientEvents['list:leave'],
  ): Promise<{ ok: boolean }> {
    if (body?.listId) await client.leave(listRoom(body.listId));
    return { ok: true };
  }

  // ── API interna usada por los servicios de dominio ──────────────────
  emitToList<E extends ServerEventName>(listId: string, event: E, payload: ServerEvents[E]): void {
    this.server?.to(listRoom(listId)).emit(event, payload);
  }

  emitToUser<E extends ServerEventName>(userId: string, event: E, payload: ServerEvents[E]): void {
    this.server?.to(userRoom(userId)).emit(event, payload);
  }

  /** Mete a un usuario ya conectado en la sala de una lista recién compartida */
  async addUserToListRoom(userId: string, listId: string): Promise<void> {
    const sockets = await this.server?.in(userRoom(userId)).fetchSockets();
    await Promise.all((sockets ?? []).map((socket) => socket.join(listRoom(listId))));
  }

  async removeUserFromListRoom(userId: string, listId: string): Promise<void> {
    const sockets = await this.server?.in(userRoom(userId)).fetchSockets();
    await Promise.all((sockets ?? []).map((socket) => socket.leave(listRoom(listId))));
  }

  /** Corta todas las conexiones de un usuario (cuenta desactivada o sesiones revocadas) */
  async disconnectUser(userId: string): Promise<void> {
    this.server?.in(userRoom(userId)).disconnectSockets(true);
  }
}
