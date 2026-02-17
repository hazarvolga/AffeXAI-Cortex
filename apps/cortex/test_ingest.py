import requests
import json
import time

CORTEX_URL = "http://localhost:8000"

def test_ingest():
    print("🚀 Testing Signal Ingestion...")
    
    signal = {
        "tenantId": "test-tenant-123",
        "source": "social-media",
        "type": "post_created",
        "data": {
            "platform": "twitter",
            "content": "Just launched our new AI feature! #AI #Tech",
            "author": "user_001"
        },
        "timestamp": str(time.time())
    }
    
    try:
        response = requests.post(f"{CORTEX_URL}/signals/ingest", json=signal)
        if response.status_code == 200:
            print("✅ Ingestion Successful!")
            print(f"Response: {response.json()}")
        else:
            print(f"❌ Ingestion Failed: {response.status_code}")
            print(response.text)
            
    except Exception as e:
        print(f"❌ Connection Error: {str(e)}")
        print("Make sure Cortex is running locally on port 8000")

if __name__ == "__main__":
    test_ingest()
