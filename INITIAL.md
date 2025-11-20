## FEATURE:

I want to build an Agent Gateway Service using NodeJS, Typescript, routing-controllers, mongoose and fastmcp
. It should have the following features:

- A MCP Registery, where we can onboard and register multiple MCP servers.
- A Tools List where we can see all the onboarded tools.
- An Tools Selection System where Applications Onboarded to Identity Service can pass there token and can select Tools they want to use in there application, to understand more about how this identity service is working please check /Users/avinashkumar/Desktop/identity-service
- A Universal mcp server which will take the identity service token as input from client and then validate the token and extract the allowed mcpTools from the token, once we have a list of allowed mcp tools, we need to identity to which mcp server they belongs and then our universal mcp server will create wrapper around these tools at runtime internally calling the respective mcp server using the mcp client, so basically universal mcp server will send the list of allowed mcp tools by creating a dynamic mcp server.
- Now any agent can connect to this universal mcp server and can list & call these tools.
- We should also send tools changed notification from this universal mcp server to allow clients to know if tools list is changed.
- We will always be using httpstream transport for all the mcp server
- Here are some of the documentation references:
- FastMCP - https://www.npmjs.com/package/fastmcp
- MCP Tools - https://modelcontextprotocol.io/specification/2025-06-18/server/tools
- Meta MCP, also doing similar thing - https://github.com/metatool-ai/metamcp
- Identity Service - /Users/avinashkumar/Desktop/identity-service
