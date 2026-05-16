#!/bin/bash
echo "=== SECURE VIP REGISTRATION LINKS ==="
echo ""
psql "postgresql://postgres:DiEdeHygIWJrKSwMdRXNJmBwrajJrnev@shortline.proxy.rlwy.net:28446/railway" -c "
SELECT 
  agent_name,
  agent_code,
  'https://medisynweb-production.up.railway.app/vip-register-secure?agent=' || agent_code || '&token=' || access_token as secure_link,
  commission_rate || '%' as commission
FROM sales_agents
WHERE tenant_id = '00000000-0000-0000-0000-000000000001'
ORDER BY agent_name;
" -t
echo ""
echo "Share these links with your sales agents. Each link tracks registrations to specific agents."
