'use strict';

function isPrime(n) {
  if (n < 2) return false;
  if (n === 2) return true;
  if (n % 2 === 0) return false;
  for (let i = 3; i <= Math.sqrt(n); i += 2) {
    if (n % i === 0) return false;
  }
  return true;
}

function nextPrime(n) {
  let c = Math.max(n + 1, 2);
  while (!isPrime(c)) c++;
  return c;
}

function primesUpTo(limit) {
  const sieve = new Array(limit + 1).fill(true);
  sieve[0] = sieve[1] = false;
  for (let i = 2; i * i <= limit; i++) {
    if (sieve[i]) for (let j = i * i; j <= limit; j += i) sieve[j] = false;
  }
  return sieve.reduce((acc, v, i) => { if (v) acc.push(i); return acc; }, []);
}

function primeFactors(n) {
  const factors = [];
  for (let d = 2; d * d <= n; d++) {
    while (n % d === 0) { factors.push(d); n = Math.floor(n / d); }
  }
  if (n > 1) factors.push(n);
  return factors;
}

function nthPrime(n) {
  let count = 0, num = 1;
  while (count < n) { num++; if (isPrime(num)) count++; }
  return num;
}
