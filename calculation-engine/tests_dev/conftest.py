# conftest.py - Shared test fixtures and configuration for calculation-engine tests
import sys
import os

# Add src directory to path so tests can import modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))
