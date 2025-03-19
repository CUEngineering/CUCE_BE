-- Drop existing trigger and function if they exist
DROP TRIGGER IF EXISTS on_auth_user_role_change ON auth.users;
DROP FUNCTION IF EXISTS public.handle_user_role_jwt();

-- Create the function to update JWT with roles
CREATE OR REPLACE FUNCTION public.handle_user_role_jwt()
RETURNS trigger AS $$
BEGIN
  UPDATE auth.users
  SET raw_user_meta_data = 
    jsonb_build_object(
      'roles', 
      (SELECT array_agg(role)
       FROM public.user_roles
       WHERE user_id = NEW.user_id)
    )
  WHERE id = NEW.user_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on user_roles table
DROP TRIGGER IF EXISTS on_user_role_change ON public.user_roles;
CREATE TRIGGER on_user_role_change
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_role_jwt();

-- Grant necessary permissions
GRANT UPDATE ON auth.users TO postgres; 