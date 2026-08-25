/**
 * Reverse geocoding utility using OpenStreetMap (Nominatim)
 * Converts coordinates to a human-readable area + city format.
 * 
 * Privacy-focused: Does not retain or display exact street addresses.
 */

interface GeocodeResult {
  placeName: string;
  error?: string;
}

export async function getPlaceName(lat: number, lng: number): Promise<string | null> {
  try {
    // Using OpenStreetMap Nominatim API (No key required for low usage)
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14`,
      {
        headers: {
          // It's polite to identify the app
          'User-Agent': 'ConfessionApp/1.0 (SA Studios, USA)',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      }
    );

    if (!response.ok) {
      throw new Error('Geocoding failed');
    }

    const data = await response.json();
    
    if (data.address) {
      const { 
        suburb, 
        neighbourhood, 
        district, 
        quarter,
        city, 
        town, 
        village, 
        municipality,
        state_district 
      } = data.address;

      // 1. Determine Area (Priority: Suburb > Neighborhood > District > Quarter)
      const area = suburb || neighbourhood || district || quarter || "";

      // 2. Determine City (Priority: City > Town > Village > Municipality > State District)
      const cityLoc = city || town || village || municipality || state_district || "";

      // 3. Format Output
      if (area && cityLoc && area !== cityLoc) {
        return `${area}, ${cityLoc}`;
      } else if (area) {
        return area;
      } else if (cityLoc) {
        return cityLoc;
      } else {
        // Fallback to broader region if specific details are missing
        return data.address.state || data.address.country || "Unknown Location";
      }
    }
    
    return null;

  } catch (error) {
    console.error("Error converting coordinates:", error);
    return null;
  }
}
