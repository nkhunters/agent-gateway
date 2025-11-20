#!/bin/bash

# Save JWT token
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIzODZlM2RnbyIsImFwcGxpY2F0aW9uTmFtZSI6Ik1DUEdhdGV3YXlUZXN0IiwiZmluYW5jaWFsSWQiOiJGSU4wMDEiLCJjaGFubmVsSWQiOiJNUENHVyIsImFsbG93ZWRUb29scyI6WyIqIl0sImFsbG93ZWRBcGlzIjpbIioiXSwiaXNEZXZlbG9wZXJQb3J0YWxBUElzRW5hYmxlZCI6ZmFsc2UsImp0aSI6ImE2MjJlODA2LTJlZDgtNDk1Ny1hZTc2LTRkZDFmOGVjMDUyZSIsInR5cGUiOiJhY2Nlc3MiLCJpYXQiOjE3NjM1ODMyNzUsImV4cCI6MTc2MzU4NDE3NX0.--N70iPWvBaJBaZV8iJEGTKbVACf0EtsMgzTyY4FtHo"

BASE_URL="http://localhost:3000/api"

echo "============================================"
echo "Agent Gateway API Testing with Real Token"
echo "============================================"
echo ""

echo "=== Test 1: POST /api/mcp-servers - Register Weather MCP Server ==="
curl -s -X POST ${BASE_URL}/mcp-servers \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"serverId":"weather-mcp","name":"Weather MCP Server","description":"Provides weather information and forecasts","endpoint":"http://localhost:9000/mcp"}'
echo -e "\n"

echo "=== Test 2: POST /api/mcp-servers - Register Calendar MCP Server ==="
curl -s -X POST ${BASE_URL}/mcp-servers \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"serverId":"calendar-mcp","name":"Calendar MCP Server","description":"Provides calendar and scheduling tools","endpoint":"http://localhost:9001/mcp"}'
echo -e "\n"

echo "=== Test 3: GET /api/mcp-servers - List all servers ==="
curl -s -X GET ${BASE_URL}/mcp-servers \
  -H "Authorization: Bearer ${TOKEN}"
echo -e "\n"

echo "=== Test 4: GET /api/mcp-servers/:serverId - Get specific server ==="
curl -s -X GET ${BASE_URL}/mcp-servers/weather-mcp \
  -H "Authorization: Bearer ${TOKEN}"
echo -e "\n"

echo "=== Test 5: GET /api/tools - List all tools ==="
curl -s -X GET ${BASE_URL}/tools \
  -H "Authorization: Bearer ${TOKEN}"
echo -e "\n"

echo "=== Test 6: GET /api/tools?serverId=weather-mcp - List tools by server ==="
curl -s -X GET "${BASE_URL}/tools?serverId=weather-mcp" \
  -H "Authorization: Bearer ${TOKEN}"
echo -e "\n"

echo "=== Test 7: GET /api/tools/status - Get sync status ==="
curl -s -X GET ${BASE_URL}/tools/status \
  -H "Authorization: Bearer ${TOKEN}"
echo -e "\n"

echo "=== Test 8: POST /api/tools/sync - Trigger sync for specific server ==="
curl -s -X POST ${BASE_URL}/tools/sync \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"serverId":"weather-mcp"}'
echo -e "\n"

echo "=== Test 9: POST /api/tools/sync - Trigger sync for all servers ==="
curl -s -X POST ${BASE_URL}/tools/sync \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{}'
echo -e "\n"

echo "=== Test 10: POST /api/mcp-servers/:serverId/reconnect - Manual reconnection ==="
curl -s -X POST ${BASE_URL}/mcp-servers/weather-mcp/reconnect \
  -H "Authorization: Bearer ${TOKEN}"
echo -e "\n"

echo "=== Test 11: DELETE /api/mcp-servers/:serverId - Remove calendar server ==="
curl -s -X DELETE ${BASE_URL}/mcp-servers/calendar-mcp \
  -H "Authorization: Bearer ${TOKEN}"
echo -e "\n"

echo "=== Test 12: GET /api/mcp-servers - Verify server deleted ==="
curl -s -X GET ${BASE_URL}/mcp-servers \
  -H "Authorization: Bearer ${TOKEN}"
echo -e "\n"

echo "=== Test 13: GET /api/mcp-servers - Without token (should fail with 401) ==="
curl -s -X GET ${BASE_URL}/mcp-servers
echo -e "\n"

echo "=== Test 14: POST /api/mcp-servers - Invalid serverId format (should fail with 400) ==="
curl -s -X POST ${BASE_URL}/mcp-servers \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"serverId":"INVALID SERVER ID!","name":"Test","description":"Test description here","endpoint":"http://localhost:9000/mcp"}'
echo -e "\n"

echo "============================================"
echo "All tests completed!"
echo "============================================"
