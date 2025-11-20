#!/bin/bash

# Agent Gateway Management API Test Script
# This script tests all Management REST API endpoints

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Base URL
BASE_URL="http://localhost:3000/api"

# For testing purposes, we'll use a mock token
# In production, this would come from identity-service
MOCK_TOKEN="test-token-12345"

echo -e "${BLUE}=====================================${NC}"
echo -e "${BLUE}Agent Gateway API Testing${NC}"
echo -e "${BLUE}=====================================${NC}"
echo ""

# Function to print test headers
print_test() {
    echo -e "\n${BLUE}>>> Test: $1${NC}"
    echo "-----------------------------------"
}

# Function to print success
print_success() {
    echo -e "${GREEN}✓ SUCCESS${NC}\n"
}

# Function to print curl command
print_curl() {
    echo -e "${BLUE}CURL:${NC} $1\n"
}

# ===========================================
# Test 1: Health Check (No Auth Required)
# ===========================================
print_test "Health Check"
CURL_CMD='curl -s http://localhost:3000/health'
print_curl "$CURL_CMD"
RESPONSE=$(eval $CURL_CMD)
echo "Response: $RESPONSE"
print_success

# ===========================================
# Test 2: Register MCP Server
# ===========================================
print_test "POST /api/mcp-servers - Register new MCP server"
CURL_CMD='curl -s -X POST '"$BASE_URL"'/mcp-servers \
  -H "Authorization: Bearer '"$MOCK_TOKEN"'" \
  -H "Content-Type: application/json" \
  -d '"'"'{
    "serverId": "weather-mcp",
    "name": "Weather MCP Server",
    "description": "Provides weather information and forecasts",
    "endpoint": "http://localhost:9000/mcp"
  }'"'"''
print_curl "$CURL_CMD"
RESPONSE=$(eval $CURL_CMD)
echo "Response: $RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
print_success

# ===========================================
# Test 3: Register Second MCP Server
# ===========================================
print_test "POST /api/mcp-servers - Register second MCP server"
CURL_CMD='curl -s -X POST '"$BASE_URL"'/mcp-servers \
  -H "Authorization: Bearer '"$MOCK_TOKEN"'" \
  -H "Content-Type: application/json" \
  -d '"'"'{
    "serverId": "calendar-mcp",
    "name": "Calendar MCP Server",
    "description": "Provides calendar and scheduling tools",
    "endpoint": "http://localhost:9001/mcp"
  }'"'"''
print_curl "$CURL_CMD"
RESPONSE=$(eval $CURL_CMD)
echo "Response: $RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
print_success

# ===========================================
# Test 4: List All MCP Servers
# ===========================================
print_test "GET /api/mcp-servers - List all servers"
CURL_CMD='curl -s -X GET '"$BASE_URL"'/mcp-servers \
  -H "Authorization: Bearer '"$MOCK_TOKEN"'"'
print_curl "$CURL_CMD"
RESPONSE=$(eval $CURL_CMD)
echo "Response: $RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
print_success

# ===========================================
# Test 5: Get Specific MCP Server
# ===========================================
print_test "GET /api/mcp-servers/:serverId - Get specific server"
CURL_CMD='curl -s -X GET '"$BASE_URL"'/mcp-servers/weather-mcp \
  -H "Authorization: Bearer '"$MOCK_TOKEN"'"'
print_curl "$CURL_CMD"
RESPONSE=$(eval $CURL_CMD)
echo "Response: $RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
print_success

# ===========================================
# Test 6: List All Tools
# ===========================================
print_test "GET /api/tools - List all tools"
CURL_CMD='curl -s -X GET '"$BASE_URL"'/tools \
  -H "Authorization: Bearer '"$MOCK_TOKEN"'"'
print_curl "$CURL_CMD"
RESPONSE=$(eval $CURL_CMD)
echo "Response: $RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
print_success

# ===========================================
# Test 7: List Tools by Server
# ===========================================
print_test "GET /api/tools?serverId=weather-mcp - List tools by server"
CURL_CMD='curl -s -X GET '"$BASE_URL"'/tools?serverId=weather-mcp \
  -H "Authorization: Bearer '"$MOCK_TOKEN"'"'
print_curl "$CURL_CMD"
RESPONSE=$(eval $CURL_CMD)
echo "Response: $RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
print_success

# ===========================================
# Test 8: Get Sync Status
# ===========================================
print_test "GET /api/tools/status - Get sync status"
CURL_CMD='curl -s -X GET '"$BASE_URL"'/tools/status \
  -H "Authorization: Bearer '"$MOCK_TOKEN"'"'
print_curl "$CURL_CMD"
RESPONSE=$(eval $CURL_CMD)
echo "Response: $RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
print_success

# ===========================================
# Test 9: Trigger Sync for Specific Server
# ===========================================
print_test "POST /api/tools/sync - Trigger sync for specific server"
CURL_CMD='curl -s -X POST '"$BASE_URL"'/tools/sync \
  -H "Authorization: Bearer '"$MOCK_TOKEN"'" \
  -H "Content-Type: application/json" \
  -d '"'"'{
    "serverId": "weather-mcp"
  }'"'"''
print_curl "$CURL_CMD"
RESPONSE=$(eval $CURL_CMD)
echo "Response: $RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
print_success

# ===========================================
# Test 10: Trigger Sync for All Servers
# ===========================================
print_test "POST /api/tools/sync - Trigger sync for all servers"
CURL_CMD='curl -s -X POST '"$BASE_URL"'/tools/sync \
  -H "Authorization: Bearer '"$MOCK_TOKEN"'" \
  -H "Content-Type: application/json" \
  -d '"'"'{}'"'"''
print_curl "$CURL_CMD"
RESPONSE=$(eval $CURL_CMD)
echo "Response: $RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
print_success

# ===========================================
# Test 11: Reconnect to Server
# ===========================================
print_test "POST /api/mcp-servers/:serverId/reconnect - Manual reconnection"
CURL_CMD='curl -s -X POST '"$BASE_URL"'/mcp-servers/weather-mcp/reconnect \
  -H "Authorization: Bearer '"$MOCK_TOKEN"'"'
print_curl "$CURL_CMD"
RESPONSE=$(eval $CURL_CMD)
echo "Response: $RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
print_success

# ===========================================
# Test 12: Delete MCP Server
# ===========================================
print_test "DELETE /api/mcp-servers/:serverId - Remove server"
CURL_CMD='curl -s -X DELETE '"$BASE_URL"'/mcp-servers/calendar-mcp \
  -H "Authorization: Bearer '"$MOCK_TOKEN"'"'
print_curl "$CURL_CMD"
RESPONSE=$(eval $CURL_CMD)
echo "Response: $RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
print_success

# ===========================================
# Test 13: Verify Server Deleted
# ===========================================
print_test "GET /api/mcp-servers - Verify server deleted"
CURL_CMD='curl -s -X GET '"$BASE_URL"'/mcp-servers \
  -H "Authorization: Bearer '"$MOCK_TOKEN"'"'
print_curl "$CURL_CMD"
RESPONSE=$(eval $CURL_CMD)
echo "Response: $RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
print_success

# ===========================================
# Test 14: Test Authentication Required
# ===========================================
print_test "GET /api/mcp-servers - Without token (should fail with 401)"
CURL_CMD='curl -s -X GET '"$BASE_URL"'/mcp-servers'
print_curl "$CURL_CMD"
RESPONSE=$(eval $CURL_CMD)
echo "Response: $RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
echo -e "${GREEN}✓ Expected to fail with 401${NC}\n"

# ===========================================
# Test 15: Test Invalid Input Validation
# ===========================================
print_test "POST /api/mcp-servers - Invalid serverId format (should fail with 400)"
CURL_CMD='curl -s -X POST '"$BASE_URL"'/mcp-servers \
  -H "Authorization: Bearer '"$MOCK_TOKEN"'" \
  -H "Content-Type: application/json" \
  -d '"'"'{
    "serverId": "INVALID SERVER ID!",
    "name": "Test",
    "description": "Test description",
    "endpoint": "http://localhost:9000/mcp"
  }'"'"''
print_curl "$CURL_CMD"
RESPONSE=$(eval $CURL_CMD)
echo "Response: $RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
echo -e "${GREEN}✓ Expected to fail with 400${NC}\n"

echo -e "\n${BLUE}=====================================${NC}"
echo -e "${GREEN}All tests completed!${NC}"
echo -e "${BLUE}=====================================${NC}"
