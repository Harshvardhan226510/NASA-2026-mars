"""
Grid and Elevation Module for Mars Surface Pathfinding.
Handles Digital Elevation Models (DEMs), slope calculations, and coordinate transformations.
"""

import numpy as np
from typing import Tuple, Dict, Any, Optional


class MarsElevationGrid:
    def __init__(
        self,
        elevation_matrix: np.ndarray,
        resolution_meters: float = 25.0,
        bbox: Optional[Dict[str, float]] = None,
        max_safe_slope_deg: float = 20.0
    ):
        """
        Initialize the elevation grid.
        
        :param elevation_matrix: 2D numpy array of elevation values in meters.
        :param resolution_meters: Distance in meters per cell (pixel).
        :param bbox: Optional bounding box dict with keys 'min_lon', 'max_lon', 'min_lat', 'max_lat'.
        :param max_safe_slope_deg: Slopes exceeding this angle (in degrees) are marked impassable.
        """
        self.elevation = np.array(elevation_matrix, dtype=np.float32)
        self.rows, self.cols = self.elevation.shape
        self.resolution = resolution_meters
        self.bbox = bbox or {
            "min_lon": 283.0,
            "max_lon": 284.0,
            "min_lat": -10.0,
            "max_lat": -9.0
        }
        self.max_safe_slope_deg = max_safe_slope_deg
        
        # Calculate slope map in degrees
        self.slope_map = self._compute_slope_map()
        # Binary mask: True if safe/walkable, False if dangerous cliff
        self.walkable_mask = self.slope_map <= self.max_safe_slope_deg

    def _compute_slope_map(self) -> np.ndarray:
        """
        Compute surface slope angle in degrees for each grid cell using finite differences.
        """
        # Gradients along rows (y) and cols (x) in meters per cell
        grad_y, grad_x = np.gradient(self.elevation, self.resolution)
        # Magnitude of gradient vector = rise / run
        grad_magnitude = np.sqrt(grad_x**2 + grad_y**2)
        # Slope angle theta = arctan(rise / run)
        slope_rad = np.arctan(grad_magnitude)
        slope_deg = np.degrees(slope_rad)
        return slope_deg

    def is_in_bounds(self, r: int, c: int) -> bool:
        return 0 <= r < self.rows and 0 <= c < self.cols

    def get_elevation(self, r: int, c: int) -> float:
        return float(self.elevation[r, c])

    def get_slope(self, r: int, c: int) -> float:
        return float(self.slope_map[r, c])

    def is_walkable(self, r: int, c: int) -> bool:
        if not self.is_in_bounds(r, c):
            return False
        return bool(self.walkable_mask[r, c])

    def grid_to_geo(self, r: int, c: int) -> Tuple[float, float, float]:
        """Convert grid (row, col) to (longitude, latitude, elevation_m)."""
        lon = self.bbox["min_lon"] + (c / self.cols) * (self.bbox["max_lon"] - self.bbox["min_lon"])
        # Row 0 is top (max_lat), Row N is bottom (min_lat)
        lat = self.bbox["max_lat"] - (r / self.rows) * (self.bbox["max_lat"] - self.bbox["min_lat"])
        elev = self.get_elevation(r, c)
        return lon, lat, elev

    def geo_to_grid(self, lon: float, lat: float) -> Tuple[int, int]:
        """Convert (longitude, latitude) to nearest grid (row, col)."""
        c = int(((lon - self.bbox["min_lon"]) / (self.bbox["max_lon"] - self.bbox["min_lon"])) * self.cols)
        r = int(((self.bbox["max_lat"] - lat) / (self.bbox["max_lat"] - self.bbox["min_lat"])) * self.rows)
        c = np.clip(c, 0, self.cols - 1)
        r = np.clip(r, 0, self.rows - 1)
        return r, c

    def find_nearest_walkable(self, r: int, c: int, max_radius: int = 15) -> Optional[Tuple[int, int]]:
        """Find the nearest walkable coordinate within search radius if the target is on a cliff."""
        if self.is_walkable(r, c):
            return r, c
        limit = max(max_radius, max(self.rows, self.cols) // 2)
        best_candidate = None
        min_slope = float('inf')
        for radius in range(1, limit + 1):
            for dr in range(-radius, radius + 1):
                for dc in range(-radius, radius + 1):
                    if max(abs(dr), abs(dc)) == radius:
                        nr, nc = r + dr, c + dc
                        if not self.is_in_bounds(nr, nc):
                            continue
                        if not np.isfinite(self.elevation[nr, nc]):
                            continue
                        if self.is_walkable(nr, nc):
                            return nr, nc
                        sl = self.get_slope(nr, nc)
                        if sl < min_slope:
                            min_slope = sl
                            best_candidate = (nr, nc)
        return best_candidate

    @classmethod
    def generate_synthetic_canyon(
        cls,
        rows: int = 120,
        cols: int = 120,
        resolution_meters: float = 50.0
    ) -> "MarsElevationGrid":
        """
        Generate a realistic synthetic Martian canyon terrain (Valles Marineris simulation)
        featuring a wide central valley, towering cliff walls, and natural ramp passes.
        """
        np.random.seed(42)
        y, x = np.mgrid[0:rows, 0:cols]
        
        # Plateau base at ~ -2000m
        base_elev = -2000.0
        
        # Central winding canyon wall with a natural canyon pass at y=60
        pass_factor = np.exp(-((y - 60.0)**2) / (2 * 12.0**2)) * 0.85
        canyon = 700.0 * np.tanh((x - 60.0 - 15.0 * np.sin(y / 20.0)) / 12.0) * (1.0 - pass_factor)
        
        # Craters and natural terrain variation
        craters = 200.0 * np.sin(x / 14.0) * np.cos(y / 14.0)
        noise = np.random.normal(0, 5, (rows, cols))
        
        elevation = base_elev + canyon + craters + noise
        
        return cls(
            elevation_matrix=elevation,
            resolution_meters=resolution_meters,
            bbox={"min_lon": 283.0, "max_lon": 283.8, "min_lat": -10.0, "max_lat": -9.2},
            max_safe_slope_deg=22.0
        )
