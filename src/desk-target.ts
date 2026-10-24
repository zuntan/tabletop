import {z} from 'zod';
import type {Request} from './model';
export const deskTargetFields={deskId:z.string().min(1).max(100).describe('Required connection/desk ID from desk_connections; never inferred from a name or current desk.')};
export type DeskRequest=(payload:Request)=>Promise<unknown>;
/** Resolves and pins a connection for the entire invocation, including multi-step tools. */
export type DeskRequestFactory=(deskId:string)=>DeskRequest;
export const deskTargetDescription='Required deskId selects the paired connection. Use desk_connections to identify it. There is no current desk or one-connection fallback. ';
