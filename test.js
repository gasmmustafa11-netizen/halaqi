import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 10000,
  duration: '30s',
};

export default function () {
  const res = http.get('https://moc.gov.iq/');

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response under 2s': (r) => r.timings.duration < 2000,
  });

  sleep(1);
}
