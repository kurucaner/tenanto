/**
 * User tracking utility for generating and managing unique user identifiers
 */

const USER_ID_KEY = 'ounce_tracker_user_id';
const USER_ID_PREFIX = 'user_';

/**
 * Generates a unique user ID with timestamp and random string
 */
const generateUserId = (): string => {
  const timestamp = Date.now().toString(36);
  const randomString = Math.random().toString(36).substring(2, 15);
  return `${USER_ID_PREFIX}${timestamp}_${randomString}`;
};

/**
 * Gets or creates a unique user ID from localStorage
 * If no ID exists, creates a new one and stores it
 * @returns The user ID string
 */
export const getOrCreateUserId = (): string => {
  if (globalThis.window === undefined) {
    // Server-side rendering fallback
    return generateUserId();
  }

  try {
    let userId = localStorage.getItem(USER_ID_KEY);

    if (userId === null || userId === undefined) {
      userId = generateUserId();
      localStorage.setItem(USER_ID_KEY, userId);
    } else {
      console.info('Retrieved existing user ID:', userId);
    }

    return userId;
  } catch (error) {
    console.warn('Failed to access localStorage, generating temporary user ID:', error);
    return generateUserId();
  }
};

/**
 * Gets the current user ID without creating a new one
 * @returns The user ID string or null if not found
 */
export const getUserId = (): string | null => {
  if (globalThis.window === undefined) {
    return null;
  }

  try {
    return localStorage.getItem(USER_ID_KEY);
  } catch (error) {
    console.warn('Failed to access localStorage:', error);
    return null;
  }
};

/**
 * Clears the user ID from localStorage
 * Useful for testing or user logout scenarios
 */
export const clearUserId = (): void => {
  if (globalThis.window === undefined) {
    return;
  }

  try {
    localStorage.removeItem(USER_ID_KEY);
  } catch (error) {
    console.warn('Failed to clear user ID from localStorage:', error);
  }
};

/**
 * Checks if a user ID exists in localStorage
 * @returns True if user ID exists, false otherwise
 */
export const hasUserId = (): boolean => {
  if (globalThis.window === undefined) {
    return false;
  }

  try {
    return localStorage.getItem(USER_ID_KEY) !== null;
  } catch (error) {
    console.warn('Failed to check user ID in localStorage:', error);
    return false;
  }
};

export const handleNavigateToDashboard = ({ path }: { path: string }) => {
  const dashboardUrl = process.env.NEXT_PUBLIC_DASHBOARD_URL;
  window.open(`${dashboardUrl}${path}`, '_blank');
};

/**
 * Gets the Shopify store URL from environment variables
 * @returns The Shopify store URL or empty string if not configured
 */
export const getShopifyStoreUrl = (): string => {
  const shopifyUrl = process.env.NEXT_PUBLIC_SHOPIFY_STORE_URL;
  if (!shopifyUrl) {
    if (globalThis.window !== undefined) {
      console.warn(
        'NEXT_PUBLIC_SHOPIFY_STORE_URL is not set. Please add it to your .env.local file.'
      );
    }
    return '';
  }
  return shopifyUrl;
};

/**
 * Opens the Shopify store in a new tab
 */
export const handleNavigateToShop = () => {
  const shopUrl = getShopifyStoreUrl();
  if (shopUrl) {
    window.open(shopUrl, '_blank');
  } else {
    console.error('Shopify store URL is not configured');
  }
};

export function parseLocalDate(date: string): string {
  const parsedDate = new Date(date);
  return parsedDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
