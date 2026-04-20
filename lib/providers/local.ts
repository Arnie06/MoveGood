import {
  autocompleteLocalAddress,
  geocodeLocalAddress,
  reverseGeocodeLocalAddress
} from "@/lib/local-addresses";
import { GeocoderProvider } from "@/lib/providers/interfaces";

export class LocalDatasetGeocoderProvider implements GeocoderProvider {
  name = "local-dataset-geocoder";

  async geocode(address: string) {
    return geocodeLocalAddress(address);
  }

  async reverseGeocode(input: { lat: number; lng: number }) {
    return reverseGeocodeLocalAddress(input);
  }

  async autocomplete(query: string, limit = 5) {
    return autocompleteLocalAddress(query, limit);
  }
}
