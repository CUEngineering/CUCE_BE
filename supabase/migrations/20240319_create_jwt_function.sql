-- Create a function to get user roles
CREATE OR REPLACE FUNCTION get_user_roles(user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN (
        SELECT jsonb_agg(role)
        FROM user_roles
        WHERE user_id = $1
    );
END;
$$;

-- Create a function to get user profile data
CREATE OR REPLACE FUNCTION get_user_profile(user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    profile_data jsonb;
    user_type text;
BEGIN
    -- Get the user's role
    SELECT role INTO user_type
    FROM user_roles
    WHERE user_id = $1
    LIMIT 1;

    -- Get profile data based on user type
    CASE user_type
        WHEN 'REGISTRAR' THEN
            SELECT jsonb_build_object(
                'type', 'registrar',
                'registrar_id', r.registrar_id,
                'first_name', r.first_name,
                'last_name', r.last_name,
                'email', r.email
            ) INTO profile_data
            FROM registrars r
            WHERE r.user_id = $1;
        WHEN 'STUDENT' THEN
            SELECT jsonb_build_object(
                'type', 'student',
                'student_id', s.student_id,
                'first_name', s.first_name,
                'last_name', s.last_name,
                'email', s.email
            ) INTO profile_data
            FROM students s
            WHERE s.user_id = $1;
        ELSE
            profile_data := '{}'::jsonb;
    END CASE;

    RETURN profile_data;
END;
$$;

-- Create the main JWT function
CREATE OR REPLACE FUNCTION auth.jwt()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_id uuid;
    roles jsonb;
    profile jsonb;
BEGIN
    -- Get the user ID from the current session
    user_id := auth.uid();
    
    -- Get user roles
    roles := get_user_roles(user_id);
    
    -- Get user profile
    profile := get_user_profile(user_id);

    -- Return the custom claims
    RETURN jsonb_build_object(
        'role', roles,
        'profile', profile,
        'user_id', user_id
    );
END;
$$;

-- Create a trigger to update JWT claims when roles change
CREATE OR REPLACE FUNCTION public.handle_user_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Refresh claims for the affected user
    PERFORM auth.refresh_claims(NEW.user_id::uuid);
    RETURN NEW;
END;
$$;

-- Create triggers for user_roles table
DROP TRIGGER IF EXISTS on_user_role_change ON public.user_roles;
CREATE TRIGGER on_user_role_change
    AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
    FOR EACH ROW EXECUTE FUNCTION public.handle_user_role_change();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION auth.jwt() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_roles(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_profile(uuid) TO authenticated; 