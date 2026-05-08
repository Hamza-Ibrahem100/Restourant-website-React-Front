import React, { useState } from 'react';
import { useReservations } from '../../hooks/useFirebaseData';
import { db } from '../../firebase';
import { ref, update, remove } from 'firebase/database';

function ReservationsTab() {
  const { data: reservations = [], isLoading } = useReservations(20);
  const [selectedReservations, setSelectedReservations] = useState([]);

  const handleStatus = async (id, newStatus) => {
    try {
      await update(ref(db, `reservations/${id}`), { 
        status: newStatus,
        updatedAt: Date.now()
      });
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const confirmDelete = async (id) => {
    if (window.confirm('Delete this reservation?')) {
      try {
        await remove(ref(db, `reservations/${id}`));
        setSelectedReservations(prev => prev.filter(resId => resId !== id));
      } catch (error) {
        console.error('Error deleting:', error);
      }
    }
  };

  const handleBulkDelete = async () => {
    if (window.confirm('Delete selected reservations?')) {
      try {
        const deletePromises = selectedReservations.map(id => remove(ref(db, `reservations/${id}`)));
        await Promise.all(deletePromises);
        setSelectedReservations([]);
      } catch (error) {
        console.error('Error bulk deleting:', error);
      }
    }
  };

  if (isLoading) return <div>Loading reservations...</div>;

  return (
    <div>
      <h2 style={{ marginBottom: '24px' }}>Reservation Management</h2>
      {reservations.length === 0 && (
        <div style={{ padding: '24px', border: '2px solid var(--primary-accent)', borderRadius: '8px', marginBottom: 24, background: 'rgba(212, 165, 116, 0.1)', textAlign: 'center' }}>
          <p style={{ margin: '0 0 16px 0', color: 'var(--text-primary)', fontSize: '18px', fontWeight: '600' }}>No reservations found!</p>
        </div>
      )}

      <div className="dash-table-wrapper">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--primary-accent)' }}>
              <th style={{ textAlign: 'left', padding: '12px', color: 'var(--primary-accent)', width: '40px' }}>
                <input 
                  type="checkbox" 
                  checked={selectedReservations.length === reservations.length && reservations.length > 0}
                  onChange={(e) => { e.target.checked ? setSelectedReservations(reservations.map(r => r.id)) : setSelectedReservations([]); }}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
              </th>
              <th style={{ textAlign: 'left', padding: '12px', color: 'var(--primary-accent)' }}>Name</th>
              <th style={{ textAlign: 'left', padding: '12px', color: 'var(--primary-accent)' }}>Email</th>
              <th style={{ textAlign: 'left', padding: '12px', color: 'var(--primary-accent)' }}>Phone</th>
              <th style={{ textAlign: 'left', padding: '12px', color: 'var(--primary-accent)' }}>Date & Time</th>
              <th style={{ textAlign: 'left', padding: '12px', color: 'var(--primary-accent)' }}>Party Size</th>
              <th style={{ textAlign: 'left', padding: '12px', color: 'var(--primary-accent)' }}>Status</th>
              <th style={{ textAlign: 'left', padding: '12px', color: 'var(--primary-accent)' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {reservations.map(res => (
              <tr key={res.id} style={{ borderBottom: '1px solid var(--secondary-accent)', background: selectedReservations.includes(res.id) ? 'rgba(231, 76, 60, 0.1)' : 'transparent' }}>
                <td style={{ padding: '12px' }}>
                  <input 
                    type="checkbox" 
                    checked={selectedReservations.includes(res.id)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedReservations([...selectedReservations, res.id]);
                      else setSelectedReservations(selectedReservations.filter(id => id !== res.id));
                    }}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                </td>
                <td style={{ padding: '12px' }}>{res.name}</td>
                <td style={{ padding: '12px' }}>{res.email}</td>
                <td style={{ padding: '12px' }}>{res.phone}</td>
                <td style={{ padding: '12px' }}>{res.date} {res.time}</td>
                <td style={{ padding: '12px' }}>{res.party}</td>
                <td style={{ padding: '12px' }}>
                  <select 
                    value={res.status || 'pending'} 
                    onChange={(e) => handleStatus(res.id, e.target.value)}
                    style={{ background: 'var(--bg-dark)', color: 'var(--text-primary)', border: '1px solid var(--secondary-accent)', padding: '4px 8px', borderRadius: '4px' }}
                  >
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </td>
                <td style={{ padding: '12px' }}>
                  <button onClick={() => confirmDelete(res.id)} style={{ background: 'transparent', border: 'none', color: '#e74c3c', cursor: 'pointer', fontSize: '16px' }}>🗑</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selectedReservations.length > 0 && (
        <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(231, 76, 60, 0.1)', border: '1px solid #e74c3c', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: '#e74c3c', fontWeight: '600' }}>{selectedReservations.length} reservation(s) selected</span>
          <button onClick={handleBulkDelete} style={{ padding: '10px 20px', background: '#e74c3c', color: 'white', border: 'none', cursor: 'pointer', fontWeight: '600', borderRadius: '6px' }}>Delete Selected</button>
        </div>
      )}
    </div>
  );
}

export default ReservationsTab;
