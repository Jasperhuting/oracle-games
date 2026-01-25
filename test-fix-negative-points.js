// Test script om de API aan te roepen
fetch('/api/admin/fix-negative-points', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  }
})
.then(response => response.json())
.then(data => {
  console.log('Result:', data);
})
.catch(error => {
  console.error('Error:', error);
});
