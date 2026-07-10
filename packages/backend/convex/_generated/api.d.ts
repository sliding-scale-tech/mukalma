/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ai from "../ai.js";
import type * as auditLogsInternal from "../auditLogsInternal.js";
import type * as clerk from "../clerk.js";
import type * as dashboard from "../dashboard.js";
import type * as documents from "../documents.js";
import type * as documentsInternal from "../documentsInternal.js";
import type * as embeddings from "../embeddings.js";
import type * as embeddingsSearch from "../embeddingsSearch.js";
import type * as http from "../http.js";
import type * as httpActions from "../httpActions.js";
import type * as integrations from "../integrations.js";
import type * as integrationsActions from "../integrationsActions.js";
import type * as integrationsInternal from "../integrationsInternal.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_customFunctions from "../lib/customFunctions.js";
import type * as lib_rbac from "../lib/rbac.js";
import type * as lib_sessionAuth from "../lib/sessionAuth.js";
import type * as messages from "../messages.js";
import type * as messagesInternal from "../messagesInternal.js";
import type * as presence from "../presence.js";
import type * as sessions from "../sessions.js";
import type * as sessionsInternal from "../sessionsInternal.js";
import type * as superAdmin from "../superAdmin.js";
import type * as tenants from "../tenants.js";
import type * as tenantsActions from "../tenantsActions.js";
import type * as tenantsInternal from "../tenantsInternal.js";
import type * as threads from "../threads.js";
import type * as threadsInternal from "../threadsInternal.js";
import type * as users from "../users.js";
import type * as usersActions from "../usersActions.js";
import type * as usersInternal from "../usersInternal.js";
import type * as wahaInternal from "../wahaInternal.js";
import type * as whatsapp from "../whatsapp.js";
import type * as whatsappInternal from "../whatsappInternal.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ai: typeof ai;
  auditLogsInternal: typeof auditLogsInternal;
  clerk: typeof clerk;
  dashboard: typeof dashboard;
  documents: typeof documents;
  documentsInternal: typeof documentsInternal;
  embeddings: typeof embeddings;
  embeddingsSearch: typeof embeddingsSearch;
  http: typeof http;
  httpActions: typeof httpActions;
  integrations: typeof integrations;
  integrationsActions: typeof integrationsActions;
  integrationsInternal: typeof integrationsInternal;
  "lib/auth": typeof lib_auth;
  "lib/customFunctions": typeof lib_customFunctions;
  "lib/rbac": typeof lib_rbac;
  "lib/sessionAuth": typeof lib_sessionAuth;
  messages: typeof messages;
  messagesInternal: typeof messagesInternal;
  presence: typeof presence;
  sessions: typeof sessions;
  sessionsInternal: typeof sessionsInternal;
  superAdmin: typeof superAdmin;
  tenants: typeof tenants;
  tenantsActions: typeof tenantsActions;
  tenantsInternal: typeof tenantsInternal;
  threads: typeof threads;
  threadsInternal: typeof threadsInternal;
  users: typeof users;
  usersActions: typeof usersActions;
  usersInternal: typeof usersInternal;
  wahaInternal: typeof wahaInternal;
  whatsapp: typeof whatsapp;
  whatsappInternal: typeof whatsappInternal;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
