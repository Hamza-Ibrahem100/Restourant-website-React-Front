import React from 'react';

function OverviewTab({ analytics, ordersCount, customersCount, reservationsCount, setActiveTab }) {
  return (
    <div>
      <div className="dash-grid-stats">
        <div className="dash-stat-card">
          <h3 className="dash-stat-label">Total Revenue</h3>
          <p className="dash-stat-value accent">
            ${analytics.totalRevenue.toFixed(2)}
          </p>
        </div>
        <div 
          className="dash-stat-card clickable"
          onClick={() => setActiveTab('orders')}
        >
          <h3 className="dash-stat-label">Total Orders</h3>
          <p className="dash-stat-value">
            {ordersCount}
          </p>
          <span className="dash-stat-link">Click to view →</span>
        </div>
        <div 
          className="dash-stat-card clickable"
          onClick={() => setActiveTab('customers')}
        >
          <h3 className="dash-stat-label">Total Customers</h3>
          <p className="dash-stat-value">
            {customersCount}
          </p>
          <span className="dash-stat-link">Click to view →</span>
        </div>
        <div 
          className="dash-stat-card clickable"
          onClick={() => setActiveTab('reservations')}
        >
          <h3 className="dash-stat-label">Reservations</h3>
          <p className="dash-stat-value">
            {reservationsCount}
          </p>
          <span className="dash-stat-link">Click to view →</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
        <div 
          className="dash-stat-card clickable"
          onClick={() => setActiveTab('orders')}
        >
          <h3 style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Order Status
            <span style={{ fontSize: '12px', color: 'var(--primary-accent)' }}>→</span>
          </h3>
          {Object.entries(analytics.orderStatusCounts).map(([status, count]) => (
            <div key={status} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <span style={{ textTransform: 'capitalize' }}>{status.replace('_', ' ')}</span>
              <span>{count}</span>
            </div>
          ))}
        </div>
        <div 
          className="dash-stat-card clickable"
          onClick={() => setActiveTab('orders')}
        >
          <h3 style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Popular Items
            <span style={{ fontSize: '12px', color: 'var(--primary-accent)' }}>→</span>
          </h3>
          {analytics.popularItems.map(([item, count]) => (
            <div key={item} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <span>{item}</span>
              <span style={{ color: 'var(--primary-accent)' }}>{count} orders</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default OverviewTab;
