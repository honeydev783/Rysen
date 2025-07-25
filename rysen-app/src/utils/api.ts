import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
// const baseURL =  'http://localhost:8000';
const api = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
});
export default api;