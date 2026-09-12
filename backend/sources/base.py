from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from models import Lead


class BaseLeadSource(ABC):
    """Abstract base class for all lead intelligence data sources."""

    def __init__(self, name: str, source_type: str):
        self.name = name
        self.source_type = source_type

    @abstractmethod
    async def discover_candidates(self, criteria: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Execute discovery based on country, profession, and search criteria.
        Returns a list of raw candidate dictionaries.
        """
        pass

    @abstractmethod
    def normalize_candidate(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transform raw provider fields into standard lead format with evidence.
        """
        pass
