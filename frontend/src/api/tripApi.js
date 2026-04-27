import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export async function planTrip(tripData) {
  const response = await api.post('/trips/plan/', tripData);
  return response.data;
}

export async function getTripHistory() {
  const response = await api.get('/trips/history/');
  return response.data;
}

export async function getTripDetail(id) {
  const response = await api.get(`/trips/history/${id}/`);
  return response.data;
}

export async function deleteTrip(id) {
  const response = await api.delete(`/trips/history/${id}/`);
  return response.data;
}

export default api;
