-- Drop existing function
DROP FUNCTION IF EXISTS public.handle_user_role_jwt();

-- Create the function with debugging
CREATE OR REPLACE FUNCTION public.handle_user_role_jwt()
RETURNS trigger AS $$
DECLARE
  roles jsonb;
BEGIN
  -- Log the trigger execution
  RAISE NOTICE 'Trigger fired for user_id: %', NEW.user_id;
  
  -- Get roles and log them
  SELECT array_agg(role)::jsonb INTO roles
  FROM public.user_roles
  WHERE user_id = NEW.user_id;
  
  RAISE NOTICE 'Roles found: %', roles;
  
  -- Update user metadata and log result
  UPDATE auth.users
  SET raw_user_meta_data = jsonb_build_object('roles', roles)
  WHERE id = NEW.user_id
  RETURNING id, raw_user_meta_data INTO NEW;
  
  RAISE NOTICE 'Updated user metadata: %', NEW.raw_user_meta_data;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log any errors
    RAISE NOTICE 'Error in trigger: % %', SQLERRM, SQLSTATE;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure trigger is recreated
DROP TRIGGER IF EXISTS on_user_role_change ON public.user_roles;
CREATE TRIGGER on_user_role_change
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_role_jwt();

-- Double check permissions
GRANT UPDATE ON auth.users TO postgres;
GRANT UPDATE ON auth.users TO authenticated; 