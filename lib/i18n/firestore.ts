import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/client";

export const listenTranslations = (locale: string, callback: (data: Record<string, string>) => void) => {
  let isActive = true;
  const ref = doc(db, "translations", locale);

  const fetchTranslations = async () => {
    try {
      const snapshot = await getDoc(ref);
      if (!isActive) return;

      if (snapshot.exists()) {
        callback(snapshot.data() || {});
      } else {
        callback({});
      }
    } catch (error) {
      console.error('Error fetching translations:', error);
      if (!isActive) return;
      callback({});
    }
  };

  void fetchTranslations();
  const pollInterval = setInterval(() => {
    void fetchTranslations();
  }, 30000);

  return () => {
    isActive = false;
    clearInterval(pollInterval);
  };
};
