// API origins for permission checks
const API_ORIGINS = [
  "https://api.groundedmomentum.com/*"
];

export const hasApiPermission = async (): Promise<boolean> => {
  try {
    // Check if we have permission for at least one origin
    for (const origin of API_ORIGINS) {
      const result = await browser.permissions.contains({
        origins: [origin],
      });
      if (result) return true;
    }
    return false;
  } catch (error) {
    console.error("Error checking API permission:", error);
    return false;
  }
};

export const requestApiPermission = (): Promise<boolean> => {
  return browser.permissions
    .request({
      origins: API_ORIGINS,
    })
    .then((result) => {
      return result;
    })
    .catch((error) => {
      console.error("Error requesting permission:", error);

      throw error;
    });
};