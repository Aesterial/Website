import { useEffect, useState } from "react";
import { reverseGeocode, type Coordinates } from "@/lib/location";

type ReverseGeocodeState = {
  label: string | null;
  loading: boolean;
};

export const useReverseGeocode = (
  coords: Coordinates | null,
): ReverseGeocodeState => {
  const [label, setLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;

    if (!coords) {
      setLabel(null);
      setLoading(false);
      return () => {
        active = false;
      };
    }

    setLabel(null);
    setLoading(true);
    void reverseGeocode(coords, { timeoutMs: 5000 })
      .then((result) => {
        if (!active) return;
        setLabel(result);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [coords?.[0], coords?.[1]]);

  return { label, loading };
};
