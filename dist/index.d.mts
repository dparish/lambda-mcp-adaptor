import { z } from "zod";
import { Writable } from "node:stream";

//#region src/mcp-spec.d.ts
/** @internal */
declare const JSONRPC_VERSION = '2.0';
/**
 * Represents the contents of a `_meta` field, which clients and servers use to attach additional metadata to their interactions.
 *
 * Certain key names are reserved by MCP for protocol-level metadata; implementations MUST NOT make assumptions about values at these keys. Additionally, specific schema definitions may reserve particular names for purpose-specific metadata, as declared in those definitions.
 *
 * Valid keys have two segments:
 *
 * **Prefix:**
 * - Optional — if specified, MUST be a series of _labels_ separated by dots (`.`), followed by a slash (`/`).
 * - Labels MUST start with a letter and end with a letter or digit. Interior characters may be letters, digits, or hyphens (`-`).
 * - Any prefix consisting of zero or more labels, followed by `modelcontextprotocol` or `mcp`, followed by any label, is **reserved** for MCP use. For example: `modelcontextprotocol.io/`, `mcp.dev/`, `api.modelcontextprotocol.org/`, and `tools.mcp.com/` are all reserved.
 *
 * **Name:**
 * - Unless empty, MUST start and end with an alphanumeric character (`[a-z0-9A-Z]`).
 * - Interior characters may be alphanumeric, hyphens (`-`), underscores (`_`), or dots (`.`).
 *
 * @see [General fields: `_meta`](/specification/draft/basic/index#meta) for more details.
 * @category Common Types
 */
type MetaObject = Record<string, unknown>;
/**
 * Extends {@link MetaObject} with additional request-specific fields. All key naming rules from `MetaObject` apply.
 *
 * @see {@link MetaObject} for key naming rules and reserved prefixes.
 * @see [General fields: `_meta`](/specification/draft/basic/index#meta) for more details.
 * @category Common Types
 */
interface RequestMetaObject extends MetaObject {
  /**
     * If specified, the caller is requesting out-of-band progress notifications for this request (as represented by {@link ProgressNotification | notifications/progress}). The value of this parameter is an opaque token that will be attached to any subsequent notifications. The receiver is not obligated to provide these notifications.
     */
  progressToken?: ProgressToken;
}
/**
 * A progress token, used to associate progress notifications with the original request.
 *
 * @category Common Types
 */
type ProgressToken = string | number;
/**
 * An opaque token used to represent a cursor for pagination.
 *
 * @category Common Types
 */
type Cursor = string;
/**
 * Common params for any task-augmented request.
 *
 * @internal
 */
interface TaskAugmentedRequestParams extends RequestParams {
  /**
     * If specified, the caller is requesting task-augmented execution for this request.
     * The request will return a {@link CreateTaskResult} immediately, and the actual result can be
     * retrieved later via {@link GetTaskPayloadRequest | tasks/result}.
     *
     * Task augmentation is subject to capability negotiation - receivers MUST declare support
     * for task augmentation of specific request types in their capabilities.
     */
  task?: TaskMetadata;
}
/**
 * Common params for any request.
 *
 * @category Common Types
 */
interface RequestParams {
  _meta?: RequestMetaObject;
}
/** @internal */
interface Request {
  method: string; // Allow unofficial extensions of `Request.params` without impacting `RequestParams`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params?: {
    [key: string]: any;
  };
}
/**
 * Common params for any notification.
 *
 * @category Common Types
 */
interface NotificationParams {
  _meta?: MetaObject;
}
/** @internal */
interface Notification {
  method: string; // Allow unofficial extensions of `Notification.params` without impacting `NotificationParams`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params?: {
    [key: string]: any;
  };
}
/**
 * Common result fields.
 *
 * @category Common Types
 */
interface Result {
  _meta?: MetaObject;
  [key: string]: unknown;
}
/**
 * A uniquely identifying ID for a request in JSON-RPC.
 *
 * @category Common Types
 */
type RequestId = string | number;
/**
 * A request that expects a response.
 *
 * @category JSON-RPC
 */
interface JSONRPCRequest extends Request {
  jsonrpc: typeof JSONRPC_VERSION;
  id: RequestId;
}
/**
 * A notification which does not expect a response.
 *
 * @category JSON-RPC
 */
interface JSONRPCNotification extends Notification {
  jsonrpc: typeof JSONRPC_VERSION;
}
/* Initialization */
/**
 * Parameters for an `initialize` request.
 *
 * @example Full client capabilities
 * {@includeCode ./examples/InitializeRequestParams/full-client-capabilities.json}
 *
 * @category `initialize`
 */
interface InitializeRequestParams extends RequestParams {
  /**
     * The latest version of the Model Context Protocol that the client supports. The client MAY decide to support older versions as well.
     */
  protocolVersion: string;
  capabilities: ClientCapabilities;
  clientInfo: Implementation;
}
/**
 * This request is sent from the client to the server when it first connects, asking it to begin initialization.
 *
 * @example Initialize request
 * {@includeCode ./examples/InitializeRequest/initialize-request.json}
 *
 * @category `initialize`
 */
interface InitializeRequest extends JSONRPCRequest {
  method: 'initialize';
  params: InitializeRequestParams;
}
/**
 * The result returned by the server for an {@link InitializeRequest | initialize} request.
 *
 * @example Full server capabilities
 * {@includeCode ./examples/InitializeResult/full-server-capabilities.json}
 *
 * @category `initialize`
 */
interface InitializeResult extends Result {
  /**
     * The version of the Model Context Protocol that the server wants to use. This may not match the version that the client requested. If the client cannot support this version, it MUST disconnect.
     */
  protocolVersion: string;
  capabilities: ServerCapabilities;
  serverInfo: Implementation;
  /**
     * Instructions describing how to use the server and its features.
     *
     * This can be used by clients to improve the LLM's understanding of available tools, resources, etc. It can be thought of like a "hint" to the model. For example, this information MAY be added to the system prompt.
     */
  instructions?: string;
}
/**
 * This notification is sent from the client to the server after initialization has finished.
 *
 * @example Initialized notification
 * {@includeCode ./examples/InitializedNotification/initialized-notification.json}
 *
 * @category `notifications/initialized`
 */
interface InitializedNotification extends JSONRPCNotification {
  method: 'notifications/initialized';
  params?: NotificationParams;
}
/**
 * Capabilities a client may support. Known capabilities are defined here, in this schema, but this is not a closed set: any client can define its own, additional capabilities.
 *
 * @category `initialize`
 */
interface ClientCapabilities {
  /**
     * Experimental, non-standard capabilities that the client supports.
     */
  experimental?: {
    [key: string]: object;
  };
  /**
     * Present if the client supports listing roots.
     *
     * @example Roots — minimum baseline support
     * {@includeCode ./examples/ClientCapabilities/roots-minimum-baseline-support.json}
     *
     * @example Roots — list changed notifications
     * {@includeCode ./examples/ClientCapabilities/roots-list-changed-notifications.json}
     */
  roots?: {
    /**
         * Whether the client supports notifications for changes to the roots list.
         */
    listChanged?: boolean;
  };
  /**
     * Present if the client supports sampling from an LLM.
     *
     * @example Sampling — minimum baseline support
     * {@includeCode ./examples/ClientCapabilities/sampling-minimum-baseline-support.json}
     *
     * @example Sampling — tool use support
     * {@includeCode ./examples/ClientCapabilities/sampling-tool-use-support.json}
     *
     * @example Sampling — context inclusion support (soft-deprecated)
     * {@includeCode ./examples/ClientCapabilities/sampling-context-inclusion-support-soft-deprecated.json}
     */
  sampling?: {
    /**
         * Whether the client supports context inclusion via `includeContext` parameter.
         * If not declared, servers SHOULD only use `includeContext: "none"` (or omit it).
         */
    context?: object;
    /**
         * Whether the client supports tool use via `tools` and `toolChoice` parameters.
         */
    tools?: object;
  };
  /**
     * Present if the client supports elicitation from the server.
     *
     * @example Elicitation — form and URL mode support
     * {@includeCode ./examples/ClientCapabilities/elicitation-form-and-url-mode-support.json}
     *
     * @example Elicitation — form mode only (implicit)
     * {@includeCode ./examples/ClientCapabilities/elicitation-form-only-implicit.json}
     */
  elicitation?: {
    form?: object;
    url?: object;
  };
  /**
     * Present if the client supports task-augmented requests.
     */
  tasks?: {
    /**
         * Whether this client supports {@link ListTasksRequest | tasks/list}.
         */
    list?: object;
    /**
         * Whether this client supports {@link CancelTaskRequest | tasks/cancel}.
         */
    cancel?: object;
    /**
         * Specifies which request types can be augmented with tasks.
         */
    requests?: {
      /**
             * Task support for sampling-related requests.
             */
      sampling?: {
        /**
                 * Whether the client supports task-augmented `sampling/createMessage` requests.
                 */
        createMessage?: object;
      };
      /**
             * Task support for elicitation-related requests.
             */
      elicitation?: {
        /**
                 * Whether the client supports task-augmented {@link ElicitRequest | elicitation/create} requests.
                 */
        create?: object;
      };
    };
  };
}
/**
 * Capabilities that a server may support. Known capabilities are defined here, in this schema, but this is not a closed set: any server can define its own, additional capabilities.
 *
 * @category `initialize`
 */
interface ServerCapabilities {
  /**
     * Experimental, non-standard capabilities that the server supports.
     */
  experimental?: {
    [key: string]: object;
  };
  /**
     * Present if the server supports sending log messages to the client.
     *
     * @example Logging — minimum baseline support
     * {@includeCode ./examples/ServerCapabilities/logging-minimum-baseline-support.json}
     */
  logging?: object;
  /**
     * Present if the server supports argument autocompletion suggestions.
     *
     * @example Completions — minimum baseline support
     * {@includeCode ./examples/ServerCapabilities/completions-minimum-baseline-support.json}
     */
  completions?: object;
  /**
     * Present if the server offers any prompt templates.
     *
     * @example Prompts — minimum baseline support
     * {@includeCode ./examples/ServerCapabilities/prompts-minimum-baseline-support.json}
     *
     * @example Prompts — list changed notifications
     * {@includeCode ./examples/ServerCapabilities/prompts-list-changed-notifications.json}
     */
  prompts?: {
    /**
         * Whether this server supports notifications for changes to the prompt list.
         */
    listChanged?: boolean;
  };
  /**
     * Present if the server offers any resources to read.
     *
     * @example Resources — minimum baseline support
     * {@includeCode ./examples/ServerCapabilities/resources-minimum-baseline-support.json}
     *
     * @example Resources — subscription to individual resource updates (only)
     * {@includeCode ./examples/ServerCapabilities/resources-subscription-to-individual-resource-updates-only.json}
     *
     * @example Resources — list changed notifications (only)
     * {@includeCode ./examples/ServerCapabilities/resources-list-changed-notifications-only.json}
     *
     * @example Resources — all notifications
     * {@includeCode ./examples/ServerCapabilities/resources-all-notifications.json}
     */
  resources?: {
    /**
         * Whether this server supports subscribing to resource updates.
         */
    subscribe?: boolean;
    /**
         * Whether this server supports notifications for changes to the resource list.
         */
    listChanged?: boolean;
  };
  /**
     * Present if the server offers any tools to call.
     *
     * @example Tools — minimum baseline support
     * {@includeCode ./examples/ServerCapabilities/tools-minimum-baseline-support.json}
     *
     * @example Tools — list changed notifications
     * {@includeCode ./examples/ServerCapabilities/tools-list-changed-notifications.json}
     */
  tools?: {
    /**
         * Whether this server supports notifications for changes to the tool list.
         */
    listChanged?: boolean;
  };
  /**
     * Present if the server supports task-augmented requests.
     */
  tasks?: {
    /**
         * Whether this server supports {@link ListTasksRequest | tasks/list}.
         */
    list?: object;
    /**
         * Whether this server supports {@link CancelTaskRequest | tasks/cancel}.
         */
    cancel?: object;
    /**
         * Specifies which request types can be augmented with tasks.
         */
    requests?: {
      /**
             * Task support for tool-related requests.
             */
      tools?: {
        /**
                 * Whether the server supports task-augmented {@link CallToolRequest | tools/call} requests.
                 */
        call?: object;
      };
    };
  };
}
/**
 * An optionally-sized icon that can be displayed in a user interface.
 *
 * @category Common Types
 */
interface Icon {
  /**
     * A standard URI pointing to an icon resource. May be an HTTP/HTTPS URL or a
     * `data:` URI with Base64-encoded image data.
     *
     * Consumers SHOULD take steps to ensure URLs serving icons are from the
     * same domain as the client/server or a trusted domain.
     *
     * Consumers SHOULD take appropriate precautions when consuming SVGs as they can contain
     * executable JavaScript.
     *
     * @format uri
     */
  src: string;
  /**
     * Optional MIME type override if the source MIME type is missing or generic.
     * For example: `"image/png"`, `"image/jpeg"`, or `"image/svg+xml"`.
     */
  mimeType?: string;
  /**
     * Optional array of strings that specify sizes at which the icon can be used.
     * Each string should be in WxH format (e.g., `"48x48"`, `"96x96"`) or `"any"` for scalable formats like SVG.
     *
     * If not provided, the client should assume that the icon can be used at any size.
     */
  sizes?: string[];
  /**
     * Optional specifier for the theme this icon is designed for. `"light"` indicates
     * the icon is designed to be used with a light background, and `"dark"` indicates
     * the icon is designed to be used with a dark background.
     *
     * If not provided, the client should assume the icon can be used with any theme.
     */
  theme?: 'light' | 'dark';
}
/**
 * Base interface to add `icons` property.
 *
 * @internal
 */
interface Icons {
  /**
     * Optional set of sized icons that the client can display in a user interface.
     *
     * Clients that support rendering icons MUST support at least the following MIME types:
     * - `image/png` - PNG images (safe, universal compatibility)
     * - `image/jpeg` (and `image/jpg`) - JPEG images (safe, universal compatibility)
     *
     * Clients that support rendering icons SHOULD also support:
     * - `image/svg+xml` - SVG images (scalable but requires security precautions)
     * - `image/webp` - WebP images (modern, efficient format)
     */
  icons?: Icon[];
}
/**
 * Base interface for metadata with name (identifier) and title (display name) properties.
 *
 * @internal
 */
interface BaseMetadata {
  /**
     * Intended for programmatic or logical use, but used as a display name in past specs or fallback (if title isn't present).
     */
  name: string;
  /**
     * Intended for UI and end-user contexts — optimized to be human-readable and easily understood,
     * even by those unfamiliar with domain-specific terminology.
     *
     * If not provided, the name should be used for display (except for {@link Tool},
     * where `annotations.title` should be given precedence over using `name`,
     * if present).
     */
  title?: string;
}
/**
 * Describes the MCP implementation.
 *
 * @category `initialize`
 */
interface Implementation extends BaseMetadata, Icons {
  version: string;
  /**
     * An optional human-readable description of what this implementation does.
     *
     * This can be used by clients or servers to provide context about their purpose
     * and capabilities. For example, a server might describe the types of resources
     * or tools it provides, while a client might describe its intended use case.
     */
  description?: string;
  /**
     * An optional URL of the website for this implementation.
     *
     * @format uri
     */
  websiteUrl?: string;
}
/* Pagination */
/**
 * Common params for paginated requests.
 *
 * @example List request with cursor
 * {@includeCode ./examples/PaginatedRequestParams/list-with-cursor.json}
 *
 * @category Common Types
 */
interface PaginatedRequestParams extends RequestParams {
  /**
     * An opaque token representing the current pagination position.
     * If provided, the server should return results starting after this cursor.
     */
  cursor?: Cursor;
}
/** @internal */
interface PaginatedRequest extends JSONRPCRequest {
  params?: PaginatedRequestParams;
}
/** @internal */
interface PaginatedResult extends Result {
  /**
     * An opaque token representing the pagination position after the last returned result.
     * If present, there may be more results available.
     */
  nextCursor?: Cursor;
}
/* Resources */
/**
 * Sent from the client to request a list of resources the server has.
 *
 * @example List resources request
 * {@includeCode ./examples/ListResourcesRequest/list-resources-request.json}
 *
 * @category `resources/list`
 */
interface ListResourcesRequest extends PaginatedRequest {
  method: 'resources/list';
}
/**
 * The result returned by the server for a {@link ListResourcesRequest | resources/list} request.
 *
 * @example Resources list with cursor
 * {@includeCode ./examples/ListResourcesResult/resources-list-with-cursor.json}
 *
 * @category `resources/list`
 */
interface ListResourcesResult extends PaginatedResult {
  resources: Resource[];
}
/**
 * Common params for resource-related requests.
 *
 * @internal
 */
interface ResourceRequestParams extends RequestParams {
  /**
     * The URI of the resource. The URI can use any protocol; it is up to the server how to interpret it.
     *
     * @format uri
     */
  uri: string;
}
/**
 * Parameters for a `resources/read` request.
 *
 * @category `resources/read`
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface ReadResourceRequestParams extends ResourceRequestParams {}
/**
 * Sent from the client to the server, to read a specific resource URI.
 *
 * @example Read resource request
 * {@includeCode ./examples/ReadResourceRequest/read-resource-request.json}
 *
 * @category `resources/read`
 */
interface ReadResourceRequest extends JSONRPCRequest {
  method: 'resources/read';
  params: ReadResourceRequestParams;
}
/**
 * The result returned by the server for a {@link ReadResourceRequest | resources/read} request.
 *
 * @example File resource contents
 * {@includeCode ./examples/ReadResourceResult/file-resource-contents.json}
 *
 * @category `resources/read`
 */
interface ReadResourceResult extends Result {
  contents: (TextResourceContents | BlobResourceContents)[];
}
/**
 * A known resource that the server is capable of reading.
 *
 * @example File resource with annotations
 * {@includeCode ./examples/Resource/file-resource-with-annotations.json}
 *
 * @category `resources/list`
 */
interface Resource extends BaseMetadata, Icons {
  /**
     * The URI of this resource.
     *
     * @format uri
     */
  uri: string;
  /**
     * A description of what this resource represents.
     *
     * This can be used by clients to improve the LLM's understanding of available resources. It can be thought of like a "hint" to the model.
     */
  description?: string;
  /**
     * The MIME type of this resource, if known.
     */
  mimeType?: string;
  /**
     * Optional annotations for the client.
     */
  annotations?: Annotations;
  /**
     * The size of the raw resource content, in bytes (i.e., before base64 encoding or any tokenization), if known.
     *
     * This can be used by Hosts to display file sizes and estimate context window usage.
     */
  size?: number;
  _meta?: MetaObject;
}
/**
 * The contents of a specific resource or sub-resource.
 *
 * @internal
 */
interface ResourceContents {
  /**
     * The URI of this resource.
     *
     * @format uri
     */
  uri: string;
  /**
     * The MIME type of this resource, if known.
     */
  mimeType?: string;
  _meta?: MetaObject;
}
/**
 * @example Text file contents
 * {@includeCode ./examples/TextResourceContents/text-file-contents.json}
 *
 * @category Content
 */
interface TextResourceContents extends ResourceContents {
  /**
     * The text of the item. This must only be set if the item can actually be represented as text (not binary data).
     */
  text: string;
}
/**
 * @example Image file contents
 * {@includeCode ./examples/BlobResourceContents/image-file-contents.json}
 *
 * @category Content
 */
interface BlobResourceContents extends ResourceContents {
  /**
     * A base64-encoded string representing the binary data of the item.
     *
     * @format byte
     */
  blob: string;
}
/* Prompts */
/**
 * Sent from the client to request a list of prompts and prompt templates the server has.
 *
 * @example List prompts request
 * {@includeCode ./examples/ListPromptsRequest/list-prompts-request.json}
 *
 * @category `prompts/list`
 */
interface ListPromptsRequest extends PaginatedRequest {
  method: 'prompts/list';
}
/**
 * The result returned by the server for a {@link ListPromptsRequest | prompts/list} request.
 *
 * @example Prompts list with cursor
 * {@includeCode ./examples/ListPromptsResult/prompts-list-with-cursor.json}
 *
 * @category `prompts/list`
 */
interface ListPromptsResult extends PaginatedResult {
  prompts: Prompt[];
}
/**
 * Parameters for a `prompts/get` request.
 *
 * @example Get code review prompt
 * {@includeCode ./examples/GetPromptRequestParams/get-code-review-prompt.json}
 *
 * @category `prompts/get`
 */
interface GetPromptRequestParams extends RequestParams {
  /**
     * The name of the prompt or prompt template.
     */
  name: string;
  /**
     * Arguments to use for templating the prompt.
     */
  arguments?: {
    [key: string]: string;
  };
}
/**
 * Used by the client to get a prompt provided by the server.
 *
 * @example Get prompt request
 * {@includeCode ./examples/GetPromptRequest/get-prompt-request.json}
 *
 * @category `prompts/get`
 */
interface GetPromptRequest extends JSONRPCRequest {
  method: 'prompts/get';
  params: GetPromptRequestParams;
}
/**
 * The result returned by the server for a {@link GetPromptRequest | prompts/get} request.
 *
 * @example Code review prompt
 * {@includeCode ./examples/GetPromptResult/code-review-prompt.json}
 *
 * @category `prompts/get`
 */
interface GetPromptResult extends Result {
  /**
     * An optional description for the prompt.
     */
  description?: string;
  messages: PromptMessage[];
}
/**
 * A prompt or prompt template that the server offers.
 *
 * @category `prompts/list`
 */
interface Prompt extends BaseMetadata, Icons {
  /**
     * An optional description of what this prompt provides
     */
  description?: string;
  /**
     * A list of arguments to use for templating the prompt.
     */
  arguments?: PromptArgument[];
  _meta?: MetaObject;
}
/**
 * Describes an argument that a prompt can accept.
 *
 * @category `prompts/list`
 */
interface PromptArgument extends BaseMetadata {
  /**
     * A human-readable description of the argument.
     */
  description?: string;
  /**
     * Whether this argument must be provided.
     */
  required?: boolean;
}
/**
 * The sender or recipient of messages and data in a conversation.
 *
 * @category Common Types
 */
type Role = 'user' | 'assistant';
/**
 * Describes a message returned as part of a prompt.
 *
 * This is similar to {@link SamplingMessage}, but also supports the embedding of
 * resources from the MCP server.
 *
 * @category `prompts/get`
 */
interface PromptMessage {
  role: Role;
  content: ContentBlock;
}
/**
 * A resource that the server is capable of reading, included in a prompt or tool call result.
 *
 * Note: resource links returned by tools are not guaranteed to appear in the results of {@link ListResourcesRequest | resources/list} requests.
 *
 * @example File resource link
 * {@includeCode ./examples/ResourceLink/file-resource-link.json}
 *
 * @category Content
 */
interface ResourceLink extends Resource {
  type: 'resource_link';
}
/**
 * The contents of a resource, embedded into a prompt or tool call result.
 *
 * It is up to the client how best to render embedded resources for the benefit
 * of the LLM and/or the user.
 *
 * @example Embedded file resource with annotations
 * {@includeCode ./examples/EmbeddedResource/embedded-file-resource-with-annotations.json}
 *
 * @category Content
 */
interface EmbeddedResource {
  type: 'resource';
  resource: TextResourceContents | BlobResourceContents;
  /**
     * Optional annotations for the client.
     */
  annotations?: Annotations;
  _meta?: MetaObject;
}
/* Tools */
/**
 * Sent from the client to request a list of tools the server has.
 *
 * @example List tools request
 * {@includeCode ./examples/ListToolsRequest/list-tools-request.json}
 *
 * @category `tools/list`
 */
interface ListToolsRequest extends PaginatedRequest {
  method: 'tools/list';
}
/**
 * The result returned by the server for a {@link ListToolsRequest | tools/list} request.
 *
 * @example Tools list with cursor
 * {@includeCode ./examples/ListToolsResult/tools-list-with-cursor.json}
 *
 * @category `tools/list`
 */
interface ListToolsResult extends PaginatedResult {
  tools: Tool[];
}
/**
 * The result returned by the server for a {@link CallToolRequest | tools/call} request.
 *
 * @example Result with unstructured text
 * {@includeCode ./examples/CallToolResult/result-with-unstructured-text.json}
 *
 * @example Result with structured content
 * {@includeCode ./examples/CallToolResult/result-with-structured-content.json}
 *
 * @example Invalid tool input error
 * {@includeCode ./examples/CallToolResult/invalid-tool-input-error.json}
 *
 * @category `tools/call`
 */
interface CallToolResult extends Result {
  /**
     * A list of content objects that represent the unstructured result of the tool call.
     */
  content: ContentBlock[];
  /**
     * An optional JSON object that represents the structured result of the tool call.
     */
  structuredContent?: {
    [key: string]: unknown;
  };
  /**
     * Whether the tool call ended in an error.
     *
     * If not set, this is assumed to be false (the call was successful).
     *
     * Any errors that originate from the tool SHOULD be reported inside the result
     * object, with `isError` set to true, _not_ as an MCP protocol-level error
     * response. Otherwise, the LLM would not be able to see that an error occurred
     * and self-correct.
     *
     * However, any errors in _finding_ the tool, an error indicating that the
     * server does not support tool calls, or any other exceptional conditions,
     * should be reported as an MCP error response.
     */
  isError?: boolean;
}
/**
 * Parameters for a `tools/call` request.
 *
 * @example `get_weather` tool call params
 * {@includeCode ./examples/CallToolRequestParams/get-weather-tool-call-params.json}
 *
 * @example Tool call params with progress token
 * {@includeCode ./examples/CallToolRequestParams/tool-call-params-with-progress-token.json}
 *
 * @category `tools/call`
 */
interface CallToolRequestParams extends TaskAugmentedRequestParams {
  /**
     * The name of the tool.
     */
  name: string;
  /**
     * Arguments to use for the tool call.
     */
  arguments?: {
    [key: string]: unknown;
  };
}
/**
 * Used by the client to invoke a tool provided by the server.
 *
 * @example Call tool request
 * {@includeCode ./examples/CallToolRequest/call-tool-request.json}
 *
 * @category `tools/call`
 */
interface CallToolRequest extends JSONRPCRequest {
  method: 'tools/call';
  params: CallToolRequestParams;
}
/**
 * Additional properties describing a {@link Tool} to clients.
 *
 * NOTE: all properties in `ToolAnnotations` are **hints**.
 * They are not guaranteed to provide a faithful description of
 * tool behavior (including descriptive properties like `title`).
 *
 * Clients should never make tool use decisions based on `ToolAnnotations`
 * received from untrusted servers.
 *
 * @category `tools/list`
 */
interface ToolAnnotations {
  /**
     * A human-readable title for the tool.
     */
  title?: string;
  /**
     * If true, the tool does not modify its environment.
     *
     * Default: false
     */
  readOnlyHint?: boolean;
  /**
     * If true, the tool may perform destructive updates to its environment.
     * If false, the tool performs only additive updates.
     *
     * (This property is meaningful only when `readOnlyHint == false`)
     *
     * Default: true
     */
  destructiveHint?: boolean;
  /**
     * If true, calling the tool repeatedly with the same arguments
     * will have no additional effect on its environment.
     *
     * (This property is meaningful only when `readOnlyHint == false`)
     *
     * Default: false
     */
  idempotentHint?: boolean;
  /**
     * If true, this tool may interact with an "open world" of external
     * entities. If false, the tool's domain of interaction is closed.
     * For example, the world of a web search tool is open, whereas that
     * of a memory tool is not.
     *
     * Default: true
     */
  openWorldHint?: boolean;
}
/**
 * Execution-related properties for a tool.
 *
 * @category `tools/list`
 */
interface ToolExecution {
  /**
     * Indicates whether this tool supports task-augmented execution.
     * This allows clients to handle long-running operations through polling
     * the task system.
     *
     * - `"forbidden"`: Tool does not support task-augmented execution (default when absent)
     * - `"optional"`: Tool may support task-augmented execution
     * - `"required"`: Tool requires task-augmented execution
     *
     * Default: `"forbidden"`
     */
  taskSupport?: 'forbidden' | 'optional' | 'required';
}
/**
 * Definition for a tool the client can call.
 *
 * @example With default 2020-12 input schema
 * {@includeCode ./examples/Tool/with-default-2020-12-input-schema.json}
 *
 * @example With explicit draft-07 input schema
 * {@includeCode ./examples/Tool/with-explicit-draft-07-input-schema.json}
 *
 * @example With no parameters
 * {@includeCode ./examples/Tool/with-no-parameters.json}
 *
 * @example With output schema for structured content
 * {@includeCode ./examples/Tool/with-output-schema-for-structured-content.json}
 *
 * @category `tools/list`
 */
interface Tool extends BaseMetadata, Icons {
  /**
     * A human-readable description of the tool.
     *
     * This can be used by clients to improve the LLM's understanding of available tools. It can be thought of like a "hint" to the model.
     */
  description?: string;
  /**
     * A JSON Schema object defining the expected parameters for the tool.
     */
  inputSchema: {
    $schema?: string;
    type: 'object';
    properties?: {
      [key: string]: object;
    };
    required?: string[];
  };
  /**
     * Execution-related properties for this tool.
     */
  execution?: ToolExecution;
  /**
     * An optional JSON Schema object defining the structure of the tool's output returned in
     * the structuredContent field of a {@link CallToolResult}.
     *
     * Defaults to JSON Schema 2020-12 when no explicit `$schema` is provided.
     * Currently restricted to `type: "object"` at the root level.
     */
  outputSchema?: {
    $schema?: string;
    type: 'object';
    properties?: {
      [key: string]: object;
    };
    required?: string[];
  };
  /**
     * Optional additional tool information.
     *
     * Display name precedence order is: `title`, `annotations.title`, then `name`.
     */
  annotations?: ToolAnnotations;
  _meta?: MetaObject;
}
// The request was cancelled before completion
/**
 * Metadata for augmenting a request with task execution.
 * Include this in the `task` field of the request parameters.
 *
 * @category `tasks`
 */
interface TaskMetadata {
  /**
     * Requested duration in milliseconds to retain task from creation.
     */
  ttl?: number;
}
/**
 * Optional annotations for the client. The client can use annotations to inform how objects are used or displayed
 *
 * @category Common Types
 */
interface Annotations {
  /**
     * Describes who the intended audience of this object or data is.
     *
     * It can include multiple entries to indicate content useful for multiple audiences (e.g., `["user", "assistant"]`).
     */
  audience?: Role[];
  /**
     * Describes how important this data is for operating the server.
     *
     * A value of 1 means "most important," and indicates that the data is
     * effectively required, while 0 means "least important," and indicates that
     * the data is entirely optional.
     *
     * @TJS-type number
     * @minimum 0
     * @maximum 1
     */
  priority?: number;
  /**
     * The moment the resource was last modified, as an ISO 8601 formatted string.
     *
     * Should be an ISO 8601 formatted string (e.g., "2025-01-12T15:00:58Z").
     *
     * Examples: last activity timestamp in an open file, timestamp when the resource
     * was attached, etc.
     */
  lastModified?: string;
}
/**
 * @category Content
 */
type ContentBlock = TextContent | ImageContent | AudioContent | ResourceLink | EmbeddedResource;
/**
 * Text provided to or from an LLM.
 *
 * @example Text content
 * {@includeCode ./examples/TextContent/text-content.json}
 *
 * @category Content
 */
interface TextContent {
  type: 'text';
  /**
     * The text content of the message.
     */
  text: string;
  /**
     * Optional annotations for the client.
     */
  annotations?: Annotations;
  _meta?: MetaObject;
}
/**
 * An image provided to or from an LLM.
 *
 * @example `image/png` content with annotations
 * {@includeCode ./examples/ImageContent/image-png-content-with-annotations.json}
 *
 * @category Content
 */
interface ImageContent {
  type: 'image';
  /**
     * The base64-encoded image data.
     *
     * @format byte
     */
  data: string;
  /**
     * The MIME type of the image. Different providers may support different image types.
     */
  mimeType: string;
  /**
     * Optional annotations for the client.
     */
  annotations?: Annotations;
  _meta?: MetaObject;
}
/**
 * Audio provided to or from an LLM.
 *
 * @example `audio/wav` content
 * {@includeCode ./examples/AudioContent/audio-wav-content.json}
 *
 * @category Content
 */
interface AudioContent {
  type: 'audio';
  /**
     * The base64-encoded audio data.
     *
     * @format byte
     */
  data: string;
  /**
     * The MIME type of the audio. Different providers may support different audio types.
     */
  mimeType: string;
  /**
     * Optional annotations for the client.
     */
  annotations?: Annotations;
  _meta?: MetaObject;
}
//#endregion
//#region src/mcp-server.d.ts
interface MCPServerConfig {
  name: string;
  version: string;
  description?: string;
  protocolVersion?: string;
}
type NormalizedMCPServerConfig = MCPServerConfig & {
  description: string;
  protocolVersion: string;
};
type ZodSchema = z.ZodRawShape;
type ToolHandler<T extends ZodSchema> = (args: z.infer<z.ZodObject<T>>) => Promise<CallToolResult> | CallToolResult;
type ResourceHandler = (uri: string) => Promise<ReadResourceResult> | ReadResourceResult;
type PromptHandler<T extends ZodSchema> = (args: z.infer<z.ZodObject<T>>) => Promise<GetPromptResult> | GetPromptResult;
type ToolRegistration = {
  name: string;
  description: string;
  inputSchema: Tool['inputSchema'];
  handler: (args: Record<string, unknown>) => Promise<CallToolResult>;
};
type ResourceRegistration = {
  name: string;
  uri: string;
  description: string;
  handler: (uri: string) => Promise<ReadResourceResult>;
};
type PromptRegistration = {
  name: string;
  description: string;
  arguments: PromptArgument[];
  handler: (args: Record<string, unknown>) => Promise<GetPromptResult>;
};
/**
 * Main MCP Server class with Zod-based type safety
 */
declare class MCPServer {
  config: NormalizedMCPServerConfig;
  tools: Map<string, ToolRegistration>;
  resources: Map<string, ResourceRegistration>;
  prompts: Map<string, PromptRegistration>;
  constructor(config: MCPServerConfig);
  /**
       * Register a tool with Zod schema validation
       */
  tool<T extends ZodSchema>(name: string, inputSchema: T, handler: ToolHandler<T>): this;
  /**
       * Register a resource
       */
  resource(name: string, uri: string, handler: ResourceHandler): this;
  /**
       * Register a prompt with Zod schema validation
       */
  prompt<T extends ZodSchema>(name: string, inputSchema: T, handler: PromptHandler<T>): this;
  /**
       * Handle MCP protocol requests
       */
  handleRequest(request: InitializeRequest): Promise<InitializeResult>;
  handleRequest(request: InitializedNotification): Promise<null>;
  handleRequest(request: ListToolsRequest): Promise<ListToolsResult>;
  handleRequest(request: CallToolRequest): Promise<CallToolResult>;
  handleRequest(request: ListResourcesRequest): Promise<ListResourcesResult>;
  handleRequest(request: ReadResourceRequest): Promise<ReadResourceResult>;
  handleRequest(request: ListPromptsRequest): Promise<ListPromptsResult>;
  handleRequest(request: GetPromptRequest): Promise<GetPromptResult>;
  /**
       * Handle initialize request
       */
  handleInitialize(): Promise<InitializeResult>;
  /**
       * Handle tools/list request
       */
  handleToolsList(): Promise<ListToolsResult>;
  /**
       * Handle tools/call request
       */
  handleToolsCall(params: CallToolRequestParams): Promise<CallToolResult>;
  /**
       * Handle resources/list request
       */
  handleResourcesList(): Promise<ListResourcesResult>;
  /**
       * Handle resources/read request
       */
  handleResourcesRead(params: ReadResourceRequestParams): Promise<ReadResourceResult>;
  /**
       * Handle prompts/list request
       */
  handlePromptsList(): Promise<ListPromptsResult>;
  /**
       * Handle prompts/get request
       */
  handlePromptsGet(params: GetPromptRequestParams): Promise<GetPromptResult>;
  /**
       * Get server statistics
       */
  getStats(): {
    tools: number;
    resources: number;
    prompts: number;
    config: MCPServerConfig;
  };
}
//#endregion
//#region node_modules/@types/aws-lambda/common/api-gateway.d.ts
// Default authorizer type, prefer using a specific type with the "...WithAuthorizer..." variant types.
// Note that this doesn't have to be a context from a custom lambda outhorizer, AWS also has a cognito
// authorizer type and could add more, so the property won't always be a string.
type APIGatewayEventDefaultAuthorizerContext = undefined | null | {
  [name: string]: any;
};
// The requestContext property of both request authorizer and proxy integration events.
interface APIGatewayEventRequestContextWithAuthorizer<TAuthorizerContext> {
  accountId: string;
  apiId: string; // This one is a bit confusing: it is not actually present in authorizer calls
  // and proxy calls without an authorizer. We model this by allowing undefined in the type,
  // since it ends up the same and avoids breaking users that are testing the property.
  // This lets us allow parameterizing the authorizer for proxy events that know what authorizer
  // context values they have.
  authorizer: TAuthorizerContext;
  connectedAt?: number | undefined;
  connectionId?: string | undefined;
  domainName?: string | undefined;
  domainPrefix?: string | undefined;
  eventType?: string | undefined;
  extendedRequestId?: string | undefined;
  protocol: string;
  httpMethod: string;
  identity: APIGatewayEventIdentity;
  messageDirection?: string | undefined;
  messageId?: string | null | undefined;
  path: string;
  stage: string;
  requestId: string;
  requestTime?: string | undefined;
  requestTimeEpoch: number;
  resourceId: string;
  resourcePath: string;
  routeKey?: string | undefined;
}
interface APIGatewayEventClientCertificate {
  clientCertPem: string;
  serialNumber: string;
  subjectDN: string;
  issuerDN: string;
  validity: {
    notAfter: string;
    notBefore: string;
  };
}
interface APIGatewayEventIdentity {
  accessKey: string | null;
  accountId: string | null;
  apiKey: string | null;
  apiKeyId: string | null;
  caller: string | null;
  clientCert: APIGatewayEventClientCertificate | null;
  cognitoAuthenticationProvider: string | null;
  cognitoAuthenticationType: string | null;
  cognitoIdentityId: string | null;
  cognitoIdentityPoolId: string | null;
  principalOrgId: string | null;
  sourceIp: string;
  user: string | null;
  userAgent: string | null;
  userArn: string | null;
  vpcId?: string | undefined;
  vpceId?: string | undefined;
}
//#endregion
//#region node_modules/@types/aws-lambda/handler.d.ts
/**
 * {@link Handler} context parameter.
 * See {@link https://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-context.html AWS documentation}.
 */
interface Context {
  callbackWaitsForEmptyEventLoop: boolean;
  functionName: string;
  functionVersion: string;
  invokedFunctionArn: string;
  memoryLimitInMB: string;
  awsRequestId: string;
  logGroupName: string;
  logStreamName: string;
  identity?: CognitoIdentity | undefined;
  clientContext?: ClientContext | undefined;
  tenantId?: string | undefined;
  getRemainingTimeInMillis(): number; // Functions for compatibility with earlier Node.js Runtime v0.10.42
  // No longer documented, so they are deprecated, but they still work
  // as of the 12.x runtime, so they are not removed from the types.
  /** @deprecated Use handler callback or promise result */
  done(error?: Error, result?: any): void;
  /** @deprecated Use handler callback with first argument or reject a promise result */
  fail(error: Error | string): void;
  /** @deprecated Use handler callback with second argument or resolve a promise result */
  succeed(messageOrObject: any): void; // Unclear what behavior this is supposed to have, I couldn't find any still extant reference,
  // and it behaves like the above, ignoring the object parameter.
  /** @deprecated Use handler callback or promise result */
  succeed(message: string, object: any): void;
}
interface CognitoIdentity {
  cognitoIdentityId: string;
  cognitoIdentityPoolId: string;
}
interface ClientContext {
  client: ClientContextClient;
  Custom?: any;
  env: ClientContextEnv;
}
interface ClientContextClient {
  installationId: string;
  appTitle: string;
  appVersionName: string;
  appVersionCode: string;
  appPackageName: string;
}
interface ClientContextEnv {
  platformVersion: string;
  platform: string;
  make: string;
  model: string;
  locale: string;
}
/**
 * Interface for using response streaming from AWS Lambda.
 * To indicate to the runtime that Lambda should stream your function’s responses, you must wrap your function handler with the `awslambda.streamifyResponse()` decorator.
 *
 * The `streamifyResponse` decorator accepts the following additional parameter, `responseStream`, besides the default node handler parameters, `event`, and `context`.
 * The new `responseStream` object provides a stream object that your function can write data to. Data written to this stream is sent immediately to the client. You can optionally set the Content-Type header of the response to pass additional metadata to your client about the contents of the stream.
 *
 * {@link https://aws.amazon.com/blogs/compute/introducing-aws-lambda-response-streaming/ AWS blog post}
 * {@link https://docs.aws.amazon.com/lambda/latest/dg/config-rs-write-functions.html AWS documentation}
 *
 * @example <caption>Writing to the response stream</caption>
 * import 'aws-lambda';
 *
 * export const handler = awslambda.streamifyResponse(
 *   async (event, responseStream, context) => {
 *       responseStream.setContentType("text/plain");
 *       responseStream.write("Hello, world!");
 *       responseStream.end();
 *   }
 * );
 *
 * @example <caption>Using pipeline</caption>
 * import 'aws-lambda';
 * import { Readable } from 'stream';
 * import { pipeline } from 'stream/promises';
 * import zlib from 'zlib';
 *
 * export const handler = awslambda.streamifyResponse(
 *   async (event, responseStream, context) => {
 *     // As an example, convert event to a readable stream.
 *     const requestStream = Readable.from(Buffer.from(JSON.stringify(event)));
 *
 *     await pipeline(requestStream, zlib.createGzip(), responseStream);
 *   }
 * );
 */
type StreamifyHandler<TEvent = any, TResult = any> = (event: TEvent, responseStream: awslambda.HttpResponseStream, context: Context) => TResult | Promise<TResult>;
declare global {
  namespace awslambda {
    class HttpResponseStream extends Writable {
      static from(writable: Writable, metadata: Record<string, unknown>): HttpResponseStream;
      setContentType: (contentType: string) => void;
    }
    /**
             * Decorator for using response streaming from AWS Lambda.
             * To indicate to the runtime that Lambda should stream your function’s responses, you must wrap your function handler with the `awslambda.streamifyResponse()` decorator.
             *
             * The `streamifyResponse` decorator accepts the following additional parameter, `responseStream`, besides the default node handler parameters, `event`, and `context`.
             * The new `responseStream` object provides a stream object that your function can write data to. Data written to this stream is sent immediately to the client. You can optionally set the Content-Type header of the response to pass additional metadata to your client about the contents of the stream.
             *
             * {@link https://aws.amazon.com/blogs/compute/introducing-aws-lambda-response-streaming/ AWS blog post}
             * {@link https://docs.aws.amazon.com/lambda/latest/dg/config-rs-write-functions.html AWS documentation}
             *
             * @example <caption>Writing to the response stream</caption>
             * import 'aws-lambda';
             *
             * export const handler = awslambda.streamifyResponse(
             *   async (event, responseStream, context) => {
             *       responseStream.setContentType("text/plain");
             *       responseStream.write("Hello, world!");
             *       responseStream.end();
             *   }
             * );
             *
             * @example <caption>Using pipeline</caption>
             * import 'aws-lambda';
             * import { Readable } from 'stream';
             * import { pipeline } from 'stream/promises';
             * import zlib from 'zlib';
             *
             * export const handler = awslambda.streamifyResponse(
             *   async (event, responseStream, context) => {
             *     // As an example, convert event to a readable stream.
             *     const requestStream = Readable.from(Buffer.from(JSON.stringify(event)));
             *
             *     await pipeline(requestStream, zlib.createGzip(), responseStream);
             *   }
             * );
             */
    function streamifyResponse<TEvent = any, TResult = void>(handler: StreamifyHandler<TEvent, TResult>): StreamifyHandler<TEvent, TResult>;
  }
}
//#endregion
//#region node_modules/@types/aws-lambda/trigger/api-gateway-proxy.d.ts
/**
 * Works with Lambda Proxy Integration for Rest API or HTTP API integration Payload Format version 1.0
 * @see - https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-lambda.html
 */
type APIGatewayProxyEvent = APIGatewayProxyEventBase<APIGatewayEventDefaultAuthorizerContext>;
interface APIGatewayProxyEventHeaders {
  [name: string]: string | undefined;
}
interface APIGatewayProxyEventMultiValueHeaders {
  [name: string]: string[] | undefined;
}
interface APIGatewayProxyEventPathParameters {
  [name: string]: string | undefined;
}
interface APIGatewayProxyEventQueryStringParameters {
  [name: string]: string | undefined;
}
interface APIGatewayProxyEventMultiValueQueryStringParameters {
  [name: string]: string[] | undefined;
}
interface APIGatewayProxyEventStageVariables {
  [name: string]: string | undefined;
}
interface APIGatewayProxyEventBase<TAuthorizerContext> {
  body: string | null;
  headers: APIGatewayProxyEventHeaders;
  multiValueHeaders: APIGatewayProxyEventMultiValueHeaders;
  httpMethod: string;
  isBase64Encoded: boolean;
  path: string;
  pathParameters: APIGatewayProxyEventPathParameters | null;
  queryStringParameters: APIGatewayProxyEventQueryStringParameters | null;
  multiValueQueryStringParameters: APIGatewayProxyEventMultiValueQueryStringParameters | null;
  stageVariables: APIGatewayProxyEventStageVariables | null;
  requestContext: APIGatewayEventRequestContextWithAuthorizer<TAuthorizerContext>;
  resource: string;
}
/**
 * Works with Lambda Proxy Integration for Rest API or HTTP API integration Payload Format version 1.0
 * @see - https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-lambda.html
 */
interface APIGatewayProxyResult {
  statusCode: number;
  headers?: {
    [header: string]: boolean | number | string;
  } | undefined;
  multiValueHeaders?: {
    [header: string]: Array<boolean | number | string>;
  } | undefined;
  body: string;
  isBase64Encoded?: boolean | undefined;
}
/**
 * Works with HTTP API integration Payload Format version 2.0
 * @see - https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-develop-integrations-lambda.html
 */
interface APIGatewayEventRequestContextV2 {
  accountId: string;
  apiId: string;
  authentication?: {
    clientCert: APIGatewayEventClientCertificate;
  };
  domainName: string;
  domainPrefix: string;
  http: {
    method: string;
    path: string;
    protocol: string;
    sourceIp: string;
    userAgent: string;
  };
  requestId: string;
  routeKey: string;
  stage: string;
  time: string;
  timeEpoch: number;
}
/**
 * Proxy Event with adaptable requestContext for different authorizer scenarios
 */
interface APIGatewayProxyEventV2WithRequestContext<TRequestContext> {
  version: string;
  routeKey: string;
  rawPath: string;
  rawQueryString: string;
  cookies?: string[];
  headers: APIGatewayProxyEventHeaders;
  queryStringParameters?: APIGatewayProxyEventQueryStringParameters;
  requestContext: TRequestContext;
  body?: string;
  pathParameters?: APIGatewayProxyEventPathParameters;
  isBase64Encoded: boolean;
  stageVariables?: APIGatewayProxyEventStageVariables;
}
/**
 * Default Proxy event with no Authorizer
 */
type APIGatewayProxyEventV2 = APIGatewayProxyEventV2WithRequestContext<APIGatewayEventRequestContextV2>;
//#endregion
//#region src/auth/index.d.ts
type LambdaEvent$1 = APIGatewayProxyEvent | APIGatewayProxyEventV2;
interface AuthUser {
  token?: string;
  [key: string]: unknown;
}
interface AuthValidationResult {
  isValid: boolean;
  user?: AuthUser;
  token?: string;
  error?: APIGatewayProxyResult;
}
interface BearerTokenAuthConfig {
  type: 'bearer-token';
  tokens?: string[];
  validate?: (token: string, event: LambdaEvent$1) => AuthValidationResult | Promise<AuthValidationResult>;
}
type AuthConfig = BearerTokenAuthConfig;
//#endregion
//#region src/lambda-adapter.d.ts
type LambdaEvent = APIGatewayProxyEvent | APIGatewayProxyEventV2;
type LambdaHandler = (event: LambdaEvent, context: Context) => Promise<APIGatewayProxyResult>;
interface LambdaHandlerOptions {
  auth?: AuthConfig;
}
/**
 * AWS Lambda Adapter for MCP Server
 */
declare function createLambdaHandler(mcpServer: MCPServer, options?: LambdaHandlerOptions): LambdaHandler;
//#endregion
//#region src/common-schemas.d.ts
/**
 * Common schema patterns for MCP tools
 */
declare const CommonSchemas: {
  string: z.ZodString;
  number: z.ZodNumber;
  boolean: z.ZodBoolean;
  optionalString: z.ZodOptional<z.ZodString>;
  optionalNumber: z.ZodOptional<z.ZodNumber>;
  optionalBoolean: z.ZodOptional<z.ZodBoolean>;
  email: z.ZodString;
  url: z.ZodString;
  uuid: z.ZodString;
  enum: <T extends readonly [string, ...string[]]>(values: T) => z.ZodEnum<z.Writeable<T>>;
  array: <T extends z.ZodTypeAny>(itemSchema: T) => z.ZodArray<T, "many">;
  object: <T extends z.ZodRawShape>(shape: T) => z.ZodObject<T, "strip", z.ZodTypeAny, z.objectUtil.addQuestionMarks<z.baseObjectOutputType<T>, any> extends infer T_1 ? { [k in keyof T_1]: z.objectUtil.addQuestionMarks<z.baseObjectOutputType<T>, any>[k] } : never, z.baseObjectInputType<T> extends infer T_2 ? { [k_1 in keyof T_2]: z.baseObjectInputType<T>[k_1] } : never>;
};
//#endregion
//#region src/index.d.ts
declare function createMCPServer(config: ConstructorParameters<typeof MCPServer>[0]): MCPServer;
//#endregion
export { CommonSchemas, MCPServer, createLambdaHandler, createMCPServer };