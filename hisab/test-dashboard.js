import fetch from 'node-fetch';

async function testDashboard() {
  try {
    console.log('🧪 Testing dashboard API...');
    
    // Test the business analytics endpoint
    const response = await fetch('http://localhost:3001/api/dashboard/business-analytics', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // You may need to add authentication headers here
        // 'Authorization': 'Bearer YOUR_TOKEN'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Dashboard API is working!');
      console.log('📊 Financial Summary:', data.analytics?.financialSummary);
    } else {
      console.log('❌ Dashboard API error:', response.status, response.statusText);
      const errorText = await response.text();
      console.log('Error details:', errorText);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testDashboard(); 