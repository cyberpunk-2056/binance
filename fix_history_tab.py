filepath = r'D:\binance\frontend\app\(main)\trade\[pair]\page.js'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

OLD = (
    "          {bottomTab === 'HISTORY' && (\r\n"
    "            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0', color: 'var(--text-secondary)', fontSize: '13px', gap: '8px' }}>\r\n"
    "              <svg width=\"48\" height=\"48\" viewBox=\"0 0 48 48\" fill=\"none\" opacity=\"0.4\">\r\n"
    "                <circle cx=\"24\" cy=\"24\" r=\"18\" stroke=\"currentColor\" strokeWidth=\"2.5\" fill=\"none\"/>\r\n"
    "                <path d=\"M24 14v10l6 4\" stroke=\"currentColor\" strokeWidth=\"2.5\" strokeLinecap=\"round\"/>\r\n"
    "              </svg>\r\n"
    "              No order history\r\n"
    "            </div>\r\n"
    "          )}\r\n"
)

NEW = (
    "          {bottomTab === 'HISTORY' && (\r\n"
    "            orderHistory.length === 0 ? (\r\n"
    "              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0', color: 'var(--text-secondary)', fontSize: '13px', gap: '8px' }}>\r\n"
    "                <svg width=\"48\" height=\"48\" viewBox=\"0 0 48 48\" fill=\"none\" opacity=\"0.4\">\r\n"
    "                  <circle cx=\"24\" cy=\"24\" r=\"18\" stroke=\"currentColor\" strokeWidth=\"2.5\" fill=\"none\"/>\r\n"
    "                  <path d=\"M24 14v10l6 4\" stroke=\"currentColor\" strokeWidth=\"2.5\" strokeLinecap=\"round\"/>\r\n"
    "                </svg>\r\n"
    "                No order history\r\n"
    "              </div>\r\n"
    "            ) : (\r\n"
    "              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>\r\n"
    "                <thead>\r\n"
    "                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>\r\n"
    "                    {['Date', 'Pair', 'Type', 'Side', 'Price', 'Amount', 'Total', 'Status'].map((h, i) => (\r\n"
    "                      <th key={h} style={{ padding: '10px 16px', color: 'var(--text-secondary)', fontWeight: '500', textAlign: i >= 4 ? 'right' : 'left' }}>{h}</th>\r\n"
    "                    ))}\r\n"
    "                  </tr>\r\n"
    "                </thead>\r\n"
    "                <tbody>\r\n"
    "                  {orderHistory.map((order) => (\r\n"
    "                    <tr key={order.id} style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-primary)', transition: 'background 0.1s' }}\r\n"
    "                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}\r\n"
    "                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}\r\n"
    "                    >\r\n"
    "                      <td style={{ padding: '10px 16px', whiteSpace: 'nowrap', fontSize: '12px', color: 'var(--text-secondary)' }}>{new Date(order.createdAt).toLocaleString()}</td>\r\n"
    "                      <td style={{ padding: '10px 16px', fontWeight: '600' }}>{order.pair}</td>\r\n"
    "                      <td style={{ padding: '10px 16px', color: 'var(--text-secondary)' }}>{order.type}</td>\r\n"
    "                      <td style={{ padding: '10px 16px', fontWeight: '700', color: order.side === 'BUY' ? '#0ecb81' : '#f6465d' }}>{order.side}</td>\r\n"
    "                      <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'monospace' }}>{order.price?.toFixed(2)}</td>\r\n"
    "                      <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'monospace' }}>{order.amount?.toFixed(6)}</td>\r\n"
    "                      <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'monospace' }}>{(order.price * order.amount)?.toFixed(2)}</td>\r\n"
    "                      <td style={{ padding: '10px 16px', textAlign: 'right' }}>\r\n"
    "                        <span style={{ backgroundColor: 'rgba(14,203,129,0.15)', color: '#0ecb81', borderRadius: '4px', padding: '2px 8px', fontSize: '11px', fontWeight: '700' }}>FILLED</span>\r\n"
    "                      </td>\r\n"
    "                    </tr>\r\n"
    "                  ))}\r\n"
    "                </tbody>\r\n"
    "              </table>\r\n"
    "            )\r\n"
    "          )}\r\n"
)

content = content.replace(OLD, NEW, 1)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print('History tab updated.')
