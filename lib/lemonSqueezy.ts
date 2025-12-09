// CORE LOGIC: Attach the User ID to the receipt so the webhook knows who paid.
export const getCheckoutUrl = (userId: string, email: string) => {
  // 1. Get this URL from your Lemon Squeezy Dashboard -> Products -> Share
  const BASE_URL = "https://mygigglegram.lemonsqueezy.com/buy/675e173b-4d24-4ef7-94ac-2e16979f6615"; 
  
  // 2. We attach the user_id as "custom data". 
  // When the webhook fires, it reads this and flips the 'christmas_pass' boolean in Supabase.
  const params = new URLSearchParams();
  params.append('checkout[custom][user_id]', userId);
  params.append('checkout[email]', email); // Pre-fill email so Nana doesn't type it twice
  
  return `${BASE_URL}?${params.toString()}`;
};