#!/bin/bash

# Agent Gateway Management REST API - Live Testing
# Uses real JWT token from identity-service

# Fresh JWT token
TOKEN=""

BASE_URL="http://localhost:3000/api"

echo "============================================"
echo "Agent Gateway REST API - Live Testing"
echo "============================================"
echo ""

echo "=== Test 1: POST /api/mcp-servers - Register Weather MCP ==="
curl -s -X POST ${BASE_URL}/mcp-servers \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"serverId":"weather-mcp","name":"Weather MCP Server","description":"Provides weather information and forecasts","endpoint":"http://localhost:9000/mcp"}'
echo -e "\n"

echo "=== Test 2: POST /api/mcp-servers - Register Calendar MCP ==="
curl -s -X POST ${BASE_URL}/mcp-servers \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"serverId":"calendar-mcp","name":"Calendar MCP Server","description":"Provides calendar and scheduling tools","endpoint":"http://localhost:9001/mcp"}'
echo -e "\n"

echo "=== Test 3: GET /api/mcp-servers - List all servers ==="
curl -s -X GET ${BASE_URL}/mcp-servers \
  -H "Authorization: Bearer ${TOKEN}"
echo -e "\n"

echo "=== Test 4: GET /api/mcp-servers/:serverId - Get weather-mcp details ==="
curl -s -X GET ${BASE_URL}/mcp-servers/weather-mcp \
  -H "Authorization: Bearer ${TOKEN}"
echo -e "\n"

echo "=== Test 5: GET /api/tools - List all tools ==="
curl -s -X GET ${BASE_URL}/tools \
  -H "Authorization: Bearer ${TOKEN}"
echo -e "\n"

echo "=== Test 6: GET /api/tools?serverId=weather-mcp ==="
curl -s -X GET "${BASE_URL}/tools?serverId=weather-mcp" \
  -H "Authorization: Bearer ${TOKEN}"
echo -e "\n"

echo "=== Test 7: GET /api/tools/status - Sync status ==="
curl -s -X GET ${BASE_URL}/tools/status \
  -H "Authorization: Bearer ${TOKEN}"
echo -e "\n"

echo "=== Test 8: POST /api/tools/sync - Sync weather-mcp ==="
curl -s -X POST ${BASE_URL}/tools/sync \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"serverId":"weather-mcp"}'
echo -e "\n"

echo "=== Test 9: POST /api/tools/sync - Sync all servers ==="
curl -s -X POST ${BASE_URL}/tools/sync \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{}'
echo -e "\n"

echo "=== Test 10: POST /api/mcp-servers/:serverId/reconnect ==="
curl -s -X POST ${BASE_URL}/mcp-servers/weather-mcp/reconnect \
  -H "Authorization: Bearer ${TOKEN}"
echo -e "\n"

echo "=== Test 11: DELETE /api/mcp-servers/calendar-mcp ==="
curl -s -X DELETE ${BASE_URL}/mcp-servers/calendar-mcp \
  -H "Authorization: Bearer ${TOKEN}"
echo -e "\n"

echo "=== Test 12: GET /api/mcp-servers - Verify deletion ==="
curl -s -X GET ${BASE_URL}/mcp-servers \
  -H "Authorization: Bearer ${TOKEN}"
echo -e "\n"

echo "=== Test 13: No auth header (should fail 401) ==="
curl -s -X GET ${BASE_URL}/mcp-servers
echo -e "\n"

echo "=== Test 14: Invalid serverId format (should fail 400) ==="
curl -s -X POST ${BASE_URL}/mcp-servers \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"serverId":"INVALID!","name":"Test","description":"Test description here","endpoint":"http://localhost:9000/mcp"}'
echo -e "\n"

echo "============================================"
echo "Tests Complete!"
echo "============================================"
