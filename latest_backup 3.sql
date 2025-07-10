--
-- PostgreSQL database dump
--

-- Dumped from database version 16.9 (Debian 16.9-1.pgdg120+1)
-- Dumped by pg_dump version 17.2

-- Started on 2025-07-08 22:03:34

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
-- SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 5 (class 2615 OID 2200)
-- Name: public; Type: SCHEMA; Schema: -; Owner: sna_db_user
--

-- *not* creating schema, since initdb creates it


-- ALTER SCHEMA public OWNER TO sna_db_user;

--
-- TOC entry 248 (class 1255 OID 16434)
-- Name: trigger_set_timestamp(); Type: FUNCTION; Schema: public; Owner: sna_db_user
--

CREATE FUNCTION public.trigger_set_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;


-- ALTER FUNCTION public.trigger_set_timestamp() OWNER TO sna_db_user;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 215 (class 1259 OID 16435)
-- Name: class_levels; Type: TABLE; Schema: public; Owner: sna_db_user
--

CREATE TABLE public.class_levels (
    level_id integer NOT NULL,
    level_name character varying(50) NOT NULL,
    teacher_id integer,
    level_code character varying(255),
    updated_at timestamp without time zone
);


-- ALTER TABLE public.class_levels OWNER TO sna_db_user;

--
-- TOC entry 226 (class 1259 OID 16670)
-- Name: classes; Type: TABLE; Schema: public; Owner: sna_db_user
--

CREATE TABLE public.classes (
    class_id integer NOT NULL,
    name character varying(100) NOT NULL,
    class_code character varying(50) NOT NULL,
    level integer NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


-- ALTER TABLE public.classes OWNER TO sna_db_user;

--
-- TOC entry 216 (class 1259 OID 16438)
-- Name: classes_class_id_seq; Type: SEQUENCE; Schema: public; Owner: sna_db_user
--

CREATE SEQUENCE public.classes_class_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- ALTER SEQUENCE public.classes_class_id_seq OWNER TO sna_db_user;

--
-- TOC entry 3526 (class 0 OID 0)
-- Dependencies: 216
-- Name: classes_class_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sna_db_user
--

ALTER SEQUENCE public.classes_class_id_seq OWNED BY public.class_levels.level_id;


--
-- TOC entry 225 (class 1259 OID 16669)
-- Name: classes_class_id_seq1; Type: SEQUENCE; Schema: public; Owner: sna_db_user
--

CREATE SEQUENCE public.classes_class_id_seq1
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- ALTER SEQUENCE public.classes_class_id_seq1 OWNER TO sna_db_user;

--
-- TOC entry 3527 (class 0 OID 0)
-- Dependencies: 225
-- Name: classes_class_id_seq1; Type: SEQUENCE OWNED BY; Schema: public; Owner: sna_db_user
--

ALTER SEQUENCE public.classes_class_id_seq1 OWNED BY public.classes.class_id;


--
-- TOC entry 236 (class 1259 OID 16919)
-- Name: exam_results; Type: TABLE; Schema: public; Owner: sna_db_user
--

CREATE TABLE public.exam_results (
    result_id integer NOT NULL,
    student_id integer,
    exam_id integer,
    score numeric(5,2) NOT NULL,
    submission_date timestamp without time zone DEFAULT now(),
    answers jsonb,
    raw_score_obtained numeric(5,2),
    user_id integer,
    time_taken_seconds integer,
    total_possible_marks integer,
    exam_version_timestamp timestamp with time zone,
    submission_time timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


-- ALTER TABLE public.exam_results OWNER TO sna_db_user;

--
-- TOC entry 235 (class 1259 OID 16918)
-- Name: exam_results_result_id_seq; Type: SEQUENCE; Schema: public; Owner: sna_db_user
--

CREATE SEQUENCE public.exam_results_result_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- ALTER SEQUENCE public.exam_results_result_id_seq OWNER TO sna_db_user;

--
-- TOC entry 3528 (class 0 OID 0)
-- Dependencies: 235
-- Name: exam_results_result_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sna_db_user
--

ALTER SEQUENCE public.exam_results_result_id_seq OWNED BY public.exam_results.result_id;


--
-- TOC entry 230 (class 1259 OID 16871)
-- Name: exam_sections; Type: TABLE; Schema: public; Owner: sna_db_user
--

CREATE TABLE public.exam_sections (
    section_id integer NOT NULL,
    exam_id integer NOT NULL,
    section_order integer NOT NULL,
    title character varying(255) DEFAULT 'Untitled Section'::character varying NOT NULL,
    instructions text,
    section_instructions text,
    section_name text
);


-- ALTER TABLE public.exam_sections OWNER TO sna_db_user;

--
-- TOC entry 229 (class 1259 OID 16870)
-- Name: exam_sections_section_id_seq; Type: SEQUENCE; Schema: public; Owner: sna_db_user
--

CREATE SEQUENCE public.exam_sections_section_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.exam_sections_section_id_seq OWNER TO sna_db_user;

--
-- TOC entry 3529 (class 0 OID 0)
-- Dependencies: 229
-- Name: exam_sections_section_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sna_db_user
--

ALTER SEQUENCE public.exam_sections_section_id_seq OWNED BY public.exam_sections.section_id;


--
-- TOC entry 234 (class 1259 OID 16905)
-- Name: exam_sessions; Type: TABLE; Schema: public; Owner: sna_db_user
--

CREATE TABLE public.exam_sessions (
    session_id integer NOT NULL,
    student_id integer,
    exam_id integer,
    start_time timestamp without time zone NOT NULL,
    end_time timestamp without time zone,
    user_id integer,
    answers jsonb,
    progress jsonb,
    time_remaining_seconds integer,
    updated_at timestamp without time zone
);


-- ALTER TABLE public.exam_sessions OWNER TO sna_db_user;

--
-- TOC entry 233 (class 1259 OID 16904)
-- Name: exam_sessions_session_id_seq; Type: SEQUENCE; Schema: public; Owner: sna_db_user
--

CREATE SEQUENCE public.exam_sessions_session_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- ALTER SEQUENCE public.exam_sessions_session_id_seq OWNER TO sna_db_user;

--
-- TOC entry 3530 (class 0 OID 0)
-- Dependencies: 233
-- Name: exam_sessions_session_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sna_db_user
--

ALTER SEQUENCE public.exam_sessions_session_id_seq OWNED BY public.exam_sessions.session_id;


--
-- TOC entry 228 (class 1259 OID 16854)
-- Name: exams; Type: TABLE; Schema: public; Owner: sna_db_user
--

CREATE TABLE public.exams (
    exam_id integer NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    duration_minutes integer NOT NULL,
    created_by integer,
    class_level character varying(50),
    class_level_id integer,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    start_time timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    end_time timestamp with time zone,
    subject_id integer,
    exam_type character varying(50) DEFAULT 'MAIN_EXAM'::character varying NOT NULL,
    max_score integer DEFAULT 100 NOT NULL,
    term character varying(50),
    session character varying(50),
    is_locked boolean DEFAULT false NOT NULL,
    exam_instructions text,
    pass_mark integer,
    CONSTRAINT exams_exam_type_check CHECK (((exam_type)::text = ANY (ARRAY[('CA1'::character varying)::text, ('CA2'::character varying)::text, ('CA3'::character varying)::text, ('CA4'::character varying)::text, ('MID_TERM'::character varying)::text, ('MAIN_EXAM'::character varying)::text, ('OTHER_CA'::character varying)::text]))),
    CONSTRAINT exams_term_check CHECK (((term)::text = ANY (ARRAY[('FIRST'::character varying)::text, ('SECOND'::character varying)::text, ('THIRD'::character varying)::text])))
);


-- ALTER TABLE public.exams OWNER TO sna_db_user;

--
-- TOC entry 227 (class 1259 OID 16853)
-- Name: exams_exam_id_seq; Type: SEQUENCE; Schema: public; Owner: sna_db_user
--

CREATE SEQUENCE public.exams_exam_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- ALTER SEQUENCE public.exams_exam_id_seq OWNER TO sna_db_user;

--
-- TOC entry 3531 (class 0 OID 0)
-- Dependencies: 227
-- Name: exams_exam_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sna_db_user
--

ALTER SEQUENCE public.exams_exam_id_seq OWNED BY public.exams.exam_id;


--
-- TOC entry 232 (class 1259 OID 16885)
-- Name: questions; Type: TABLE; Schema: public; Owner: sna_db_user
--

CREATE TABLE public.questions (
    question_id integer NOT NULL,
    exam_id integer,
    question_text text NOT NULL,
    option_a character varying(255),
    option_b character varying(255),
    option_c character varying(255),
    option_d character varying(255),
    correct_answer character(1) NOT NULL,
    options jsonb,
    explanation text,
    marks integer DEFAULT 1 NOT NULL,
    user_id integer,
    section_id integer NOT NULL
);


-- ALTER TABLE public.questions OWNER TO sna_db_user;

--
-- TOC entry 231 (class 1259 OID 16884)
-- Name: questions_question_id_seq; Type: SEQUENCE; Schema: public; Owner: sna_db_user
--

CREATE SEQUENCE public.questions_question_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- ALTER SEQUENCE public.questions_question_id_seq OWNER TO sna_db_user;

--
-- TOC entry 3532 (class 0 OID 0)
-- Dependencies: 231
-- Name: questions_question_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sna_db_user
--

ALTER SEQUENCE public.questions_question_id_seq OWNED BY public.questions.question_id;


--
-- TOC entry 217 (class 1259 OID 16473)
-- Name: report_card_meta; Type: TABLE; Schema: public; Owner: sna_db_user
--

CREATE TABLE public.report_card_meta (
    report_id integer NOT NULL,
    student_id integer NOT NULL,
    term character varying(10) NOT NULL,
    session character varying(9) NOT NULL,
    teacher_comment text,
    principal_comment text,
    next_term_begins date,
    class_position character varying(10),
    affective_domain jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    cumulative_data jsonb,
    class_level character varying(255)
);


-- ALTER TABLE public.report_card_meta OWNER TO sna_db_user;

--
-- TOC entry 218 (class 1259 OID 16480)
-- Name: report_card_meta_report_id_seq; Type: SEQUENCE; Schema: public; Owner: sna_db_user
--

CREATE SEQUENCE public.report_card_meta_report_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- ALTER SEQUENCE public.report_card_meta_report_id_seq OWNER TO sna_db_user;

--
-- TOC entry 3533 (class 0 OID 0)
-- Dependencies: 218
-- Name: report_card_meta_report_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sna_db_user
--

ALTER SEQUENCE public.report_card_meta_report_id_seq OWNED BY public.report_card_meta.report_id;


--
-- TOC entry 224 (class 1259 OID 16603)
-- Name: results; Type: TABLE; Schema: public; Owner: sna_db_user
--

CREATE TABLE public.results (
    id integer NOT NULL,
    user_id integer,
    score integer,
    total integer,
    submitted_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


-- ALTER TABLE public.results OWNER TO sna_db_user;

--
-- TOC entry 223 (class 1259 OID 16602)
-- Name: results_id_seq; Type: SEQUENCE; Schema: public; Owner: sna_db_user
--

CREATE SEQUENCE public.results_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- ALTER SEQUENCE public.results_id_seq OWNER TO sna_db_user;

--
-- TOC entry 3534 (class 0 OID 0)
-- Dependencies: 223
-- Name: results_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sna_db_user
--

ALTER SEQUENCE public.results_id_seq OWNED BY public.results.id;


--
-- TOC entry 219 (class 1259 OID 16481)
-- Name: subjects; Type: TABLE; Schema: public; Owner: sna_db_user
--

CREATE TABLE public.subjects (
    subject_id integer NOT NULL,
    name character varying(255) NOT NULL,
    subject_code character varying(50),
    class_level_id integer NOT NULL
);


-- ALTER TABLE public.subjects OWNER TO sna_db_user;

--
-- TOC entry 220 (class 1259 OID 16484)
-- Name: subjects_subject_id_seq; Type: SEQUENCE; Schema: public; Owner: sna_db_user
--

CREATE SEQUENCE public.subjects_subject_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- ALTER SEQUENCE public.subjects_subject_id_seq OWNER TO sna_db_user;

--
-- TOC entry 3535 (class 0 OID 0)
-- Dependencies: 220
-- Name: subjects_subject_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sna_db_user
--

ALTER SEQUENCE public.subjects_subject_id_seq OWNED BY public.subjects.subject_id;


--
-- TOC entry 221 (class 1259 OID 16485)
-- Name: users; Type: TABLE; Schema: public; Owner: sna_db_user
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username character varying(50) NOT NULL,
    email character varying(100) NOT NULL,
    password text NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    is_admin boolean DEFAULT false,
    role character varying(20) DEFAULT 'student'::character varying NOT NULL,
    admission_number character varying(50),
    first_name character varying(255),
    last_name character varying(255),
    profile_picture_url text,
    dob date,
    gender character varying(10),
    updated_at timestamp without time zone,
    class_level_id integer,
    password_hash character varying(255),
    full_name character varying(255),
    reset_password_token character varying(255) DEFAULT NULL::character varying,
    reset_password_expires timestamp with time zone,
    CONSTRAINT class_level_for_students_only CHECK (((((role)::text = 'student'::text) AND (class_level_id IS NOT NULL)) OR (((role)::text <> 'student'::text) AND (class_level_id IS NULL))))
);


-- ALTER TABLE public.users OWNER TO sna_db_user;

--
-- TOC entry 222 (class 1259 OID 16494)
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: sna_db_user
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


-- ALTER SEQUENCE public.users_id_seq OWNER TO sna_db_user;

--
-- TOC entry 3536 (class 0 OID 0)
-- Dependencies: 222
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: sna_db_user
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- TOC entry 3258 (class 2604 OID 16495)
-- Name: class_levels level_id; Type: DEFAULT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.class_levels ALTER COLUMN level_id SET DEFAULT nextval('public.classes_class_id_seq'::regclass);


--
-- TOC entry 3270 (class 2604 OID 16673)
-- Name: classes class_id; Type: DEFAULT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.classes ALTER COLUMN class_id SET DEFAULT nextval('public.classes_class_id_seq1'::regclass);


--
-- TOC entry 3285 (class 2604 OID 16922)
-- Name: exam_results result_id; Type: DEFAULT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.exam_results ALTER COLUMN result_id SET DEFAULT nextval('public.exam_results_result_id_seq'::regclass);


--
-- TOC entry 3280 (class 2604 OID 16874)
-- Name: exam_sections section_id; Type: DEFAULT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.exam_sections ALTER COLUMN section_id SET DEFAULT nextval('public.exam_sections_section_id_seq'::regclass);


--
-- TOC entry 3284 (class 2604 OID 16908)
-- Name: exam_sessions session_id; Type: DEFAULT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.exam_sessions ALTER COLUMN session_id SET DEFAULT nextval('public.exam_sessions_session_id_seq'::regclass);


--
-- TOC entry 3273 (class 2604 OID 16857)
-- Name: exams exam_id; Type: DEFAULT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.exams ALTER COLUMN exam_id SET DEFAULT nextval('public.exams_exam_id_seq'::regclass);


--
-- TOC entry 3282 (class 2604 OID 16888)
-- Name: questions question_id; Type: DEFAULT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.questions ALTER COLUMN question_id SET DEFAULT nextval('public.questions_question_id_seq'::regclass);


--
-- TOC entry 3259 (class 2604 OID 16500)
-- Name: report_card_meta report_id; Type: DEFAULT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.report_card_meta ALTER COLUMN report_id SET DEFAULT nextval('public.report_card_meta_report_id_seq'::regclass);


--
-- TOC entry 3268 (class 2604 OID 16606)
-- Name: results id; Type: DEFAULT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.results ALTER COLUMN id SET DEFAULT nextval('public.results_id_seq'::regclass);


--
-- TOC entry 3262 (class 2604 OID 16501)
-- Name: subjects subject_id; Type: DEFAULT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.subjects ALTER COLUMN subject_id SET DEFAULT nextval('public.subjects_subject_id_seq'::regclass);


--
-- TOC entry 3263 (class 2604 OID 16502)
-- Name: users id; Type: DEFAULT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- TOC entry 3499 (class 0 OID 16435)
-- Dependencies: 215
-- Data for Name: class_levels; Type: TABLE DATA; Schema: public; Owner: sna_db_user
--

INSERT INTO public.class_levels VALUES (3, 'Default Level', NULL, 'DEF', NULL);
INSERT INTO public.class_levels VALUES (1, 'Primary 1', NULL, 'PRY 1', NULL);
INSERT INTO public.class_levels VALUES (2, 'Primary 2', NULL, 'PRY 2', NULL);
INSERT INTO public.class_levels VALUES (4, 'Primary 3', NULL, 'PRY 3', NULL);
INSERT INTO public.class_levels VALUES (5, 'Primary 4', NULL, 'PRY 4', NULL);
INSERT INTO public.class_levels VALUES (8, 'Primary 5', NULL, 'PRY 5', NULL);
INSERT INTO public.class_levels VALUES (9, 'JSS 1', NULL, 'J 1', NULL);
INSERT INTO public.class_levels VALUES (10, 'JSS 2', NULL, 'J 2', NULL);
INSERT INTO public.class_levels VALUES (11, 'JSS 3', NULL, 'J 3', NULL);
INSERT INTO public.class_levels VALUES (12, 'SS 1', NULL, 'S 1', NULL);
INSERT INTO public.class_levels VALUES (13, 'SS 2', NULL, 'S 2', NULL);
INSERT INTO public.class_levels VALUES (14, 'SS 3', NULL, 'S 3', NULL);


--
-- TOC entry 3510 (class 0 OID 16670)
-- Dependencies: 226
-- Data for Name: classes; Type: TABLE DATA; Schema: public; Owner: sna_db_user
--

INSERT INTO public.classes VALUES (1, 'Primary 1', 'PRY 1', 1, '2025-07-07 22:42:53.767627+00', '2025-07-07 22:42:53.767627+00');
INSERT INTO public.classes VALUES (2, 'JSS 1', 'J 1', 9, '2025-07-07 22:43:13.792777+00', '2025-07-07 22:43:13.792777+00');
INSERT INTO public.classes VALUES (3, 'JSS 2', 'J 2', 1, '2025-07-07 22:43:32.240626+00', '2025-07-07 22:43:32.240626+00');
INSERT INTO public.classes VALUES (4, 'JSS 3', 'J 3', 11, '2025-07-07 22:43:50.72954+00', '2025-07-07 22:43:50.72954+00');
INSERT INTO public.classes VALUES (5, 'Primary 2', 'PRY 2', 2, '2025-07-07 22:44:13.313902+00', '2025-07-07 22:44:13.313902+00');
INSERT INTO public.classes VALUES (6, 'Primary 3', 'PRY 3', 4, '2025-07-07 22:44:32.949539+00', '2025-07-07 22:44:32.949539+00');
INSERT INTO public.classes VALUES (7, 'Primary 4', 'PRY 4', 5, '2025-07-07 22:44:52.966918+00', '2025-07-07 22:44:52.966918+00');
INSERT INTO public.classes VALUES (8, 'Primary 5', 'PRY 5', 8, '2025-07-07 22:45:13.600962+00', '2025-07-07 22:45:13.600962+00');
INSERT INTO public.classes VALUES (9, 'SS 1', 'S 1', 12, '2025-07-07 22:48:09.099402+00', '2025-07-07 22:48:09.099402+00');
INSERT INTO public.classes VALUES (10, 'SS 2', 'S 2', 13, '2025-07-07 22:48:28.221161+00', '2025-07-07 22:48:28.221161+00');
INSERT INTO public.classes VALUES (11, 'SS 3', 'S 3', 14, '2025-07-07 22:48:43.449644+00', '2025-07-07 22:48:43.449644+00');


--
-- TOC entry 3520 (class 0 OID 16919)
-- Dependencies: 236
-- Data for Name: exam_results; Type: TABLE DATA; Schema: public; Owner: sna_db_user
--

INSERT INTO public.exam_results VALUES (1, 32, 1, 80.00, '2025-07-08 12:50:14.150745', '{"8": "B", "9": "A", "10": "C", "11": "D", "12": "B", "13": "A", "14": "A"}', 8.00, NULL, 104, 10, '2025-07-08 12:46:36.487+00', '2025-07-08 12:50:14.150745+00');
INSERT INTO public.exam_results VALUES (2, 32, 2, 10.00, '2025-07-08 13:38:05.55383', '{"19": "A"}', 1.00, NULL, 15, 10, '2025-07-08 13:36:59.619+00', '2025-07-08 13:38:05.55383+00');
INSERT INTO public.exam_results VALUES (3, 32, 5, 100.00, '2025-07-08 13:44:51.113759', '{"23": "A"}', 10.00, NULL, 4, 10, '2025-07-08 13:44:19.367+00', '2025-07-08 13:44:51.113759+00');


--
-- TOC entry 3514 (class 0 OID 16871)
-- Dependencies: 230
-- Data for Name: exam_sections; Type: TABLE DATA; Schema: public; Owner: sna_db_user
--

INSERT INTO public.exam_sections VALUES (3, 1, 1, 'Untitled Section', NULL, 'Directions: Read the passage. Then answer the questions below. 
Spider Webs 
All spiders spin webs. That''s because webs help spiders. 
Webs help spiders do three things. Webs help spiders hold eggs. 
Webs help spiders hide. And webs help spiders catch food. 
Webs help spiders hold eggs. Many spiders like to lay their 
eggs in their webs. The webs help keep the eggs together. Webs 
help spiders keep their eggs safe. 
Webs help spiders hide. Most spiders are dark. They are brown, grey, or black. But spider webs 
are light. They are white and cloudy. When spiders hide in their webs, they are harder to see. 
Webs help spiders catch food. Spider webs are sticky. When a bug flies into the web, it gets 
stuck. It moves around. It tries to get out. But it can''t. It is trapped! Spiders can tell that the bug is trapped. 
That''s because spiders feel the web move. And the spider is hungry. The spider goes to get the bug. 
As you can see, webs help spiders hold eggs. Webs help spiders hide. And webs help spiders 
catch food. Without webs, spiders would not be able to live like they do. Spiders need their webs to 
survive!', 'Section 1: COMPREHENSION PASSAGE');
INSERT INTO public.exam_sections VALUES (4, 1, 2, 'Untitled Section', NULL, 'Complete each of the following statements with the most appropriate of the options lettered A – D', 'Section 2: Lexis and structure');
INSERT INTO public.exam_sections VALUES (8, 2, 1, 'Untitled Section', NULL, 'Do this', 'Section 1: section 1');
INSERT INTO public.exam_sections VALUES (9, 5, 1, 'Untitled Section', NULL, 'This firat', 'New Section');


--
-- TOC entry 3518 (class 0 OID 16905)
-- Dependencies: 234
-- Data for Name: exam_sessions; Type: TABLE DATA; Schema: public; Owner: sna_db_user
--

INSERT INTO public.exam_sessions VALUES (1, NULL, 1, '2025-07-08 12:48:12.313455', '2025-07-08 12:50:14.150745', 32, NULL, NULL, 0, '2025-07-08 12:49:43.227778');
INSERT INTO public.exam_sessions VALUES (2, NULL, 2, '2025-07-08 13:37:50.087491', '2025-07-08 13:38:05.55383', 32, NULL, NULL, 0, NULL);
INSERT INTO public.exam_sessions VALUES (3, NULL, 5, '2025-07-08 13:44:46.333142', '2025-07-08 13:44:51.113759', 32, NULL, NULL, 0, NULL);


--
-- TOC entry 3512 (class 0 OID 16854)
-- Dependencies: 228
-- Data for Name: exams; Type: TABLE DATA; Schema: public; Owner: sna_db_user
--

INSERT INTO public.exams VALUES (1, 'ENGLISH STUDIES', NULL, 60, 24, NULL, 1, '2025-07-08 12:45:49.05568+00', '2025-07-08 12:46:36.487153+00', '2025-07-08 12:48:00+00', '2025-08-10 13:30:00+00', 2, 'MID_TERM', 10, 'FIRST', '2024-2025', false, 'ATTEMPT ALL CAREFULLY', 7);
INSERT INTO public.exams VALUES (2, 'English', NULL, 60, 24, NULL, 1, '2025-07-08 13:35:04.014094+00', '2025-07-08 13:39:09.762325+00', '2025-07-08 13:35:00+00', '2025-07-10 20:30:00+00', 2, 'MAIN_EXAM', 10, 'FIRST', '2024-2025', false, 'Do all', 80);
INSERT INTO public.exams VALUES (5, 'English', NULL, 60, 24, NULL, 1, '2025-07-08 13:44:19.367833+00', '2025-07-08 13:44:19.367833+00', '2025-07-08 13:42:00+00', '2025-07-10 16:42:00+00', 2, 'CA1', 10, 'FIRST', '2024-2025', false, 'Do this too', 75);


--
-- TOC entry 3516 (class 0 OID 16885)
-- Dependencies: 232
-- Data for Name: questions; Type: TABLE DATA; Schema: public; Owner: sna_db_user
--

INSERT INTO public.questions VALUES (8, 1, 'This passage is mostly about _____', 'goats', 'spiders', 'humans', 'living things', 'B', NULL, '', 1, NULL, 3);
INSERT INTO public.questions VALUES (9, 1, 'Spider webs help spiders _______', 'catch food', 'find enemies', 'eat and sleep', 'fight and win', 'A', NULL, '', 1, NULL, 3);
INSERT INTO public.questions VALUES (10, 1, 'Spiders need their webs to ________', 'become beautiful', 'play', 'survive', 'sing', 'C', NULL, '', 1, NULL, 3);
INSERT INTO public.questions VALUES (11, 1, 'She was so _________ from the long day that she could not stay alert.', 'good', 'happy', 'tayerd', 'stressed', 'D', NULL, '', 2, NULL, 4);
INSERT INTO public.questions VALUES (12, 1, 'My brother and I are the only ______ at home', 'boy', 'male', 'boys', 'child', 'B', NULL, '', 1, NULL, 4);
INSERT INTO public.questions VALUES (13, 1, 'The children played_________in the street until the sun set.', 'happily', 'happiness', 'happier', 'happy', 'A', NULL, '', 2, NULL, 4);
INSERT INTO public.questions VALUES (14, 1, 'I think that you’ve put too ______ salt in this soup; it is almost inedible.', 'many', 'few', 'plenty', 'much', 'D', NULL, '', 2, NULL, 4);
INSERT INTO public.questions VALUES (21, 2, 'I am a ____', 'Boy', 'Bouy', 'Buy', 'Doy', 'A', NULL, '', 1, NULL, 8);
INSERT INTO public.questions VALUES (22, 2, 'This is my ______ friend', 'Mums', 'Mums''', 'Mum', 'Mum''s', 'D', NULL, '', 9, NULL, 8);
INSERT INTO public.questions VALUES (23, 5, 'You are a ________ & _______', 'Male and boy', 'Male and female', 'Boy and girl', 'All gender', 'A', NULL, '', 10, NULL, 9);


--
-- TOC entry 3501 (class 0 OID 16473)
-- Dependencies: 217
-- Data for Name: report_card_meta; Type: TABLE DATA; Schema: public; Owner: sna_db_user
--



--
-- TOC entry 3508 (class 0 OID 16603)
-- Dependencies: 224
-- Data for Name: results; Type: TABLE DATA; Schema: public; Owner: sna_db_user
--



--
-- TOC entry 3503 (class 0 OID 16481)
-- Dependencies: 219
-- Data for Name: subjects; Type: TABLE DATA; Schema: public; Owner: sna_db_user
--

INSERT INTO public.subjects VALUES (16, 'AGRICULTURAL SCIENCE', 'AGRIC-PRY', 1);
INSERT INTO public.subjects VALUES (20, 'ARABIC LANGUAGE', 'ARA-PRY', 1);
INSERT INTO public.subjects VALUES (3, 'Basic Science', 'BST-PRY', 1);
INSERT INTO public.subjects VALUES (39, 'BIOLOGY', 'BIO-SEC', 12);
INSERT INTO public.subjects VALUES (48, 'BOOK KEEPING', 'BK-SEC', 13);
INSERT INTO public.subjects VALUES (54, 'BST', 'BST-SEC 1', 9);
INSERT INTO public.subjects VALUES (56, 'BUSINESS STDS', 'BUS-SEC 1', 9);
INSERT INTO public.subjects VALUES (37, 'CHEMISTRY', 'CHEM-SEC', 12);
INSERT INTO public.subjects VALUES (13, 'Civic education', 'CIV-PRY', 1);
INSERT INTO public.subjects VALUES (45, 'COMMERCE', 'COMM-SEC', 12);
INSERT INTO public.subjects VALUES (49, 'YORUBA', 'YOR-SEC 2', 12);
INSERT INTO public.subjects VALUES (14, 'Yoruba', 'YOR-PRY', 1);
INSERT INTO public.subjects VALUES (41, 'TECHNICAL DRAWING', 'TD-SEC', 12);
INSERT INTO public.subjects VALUES (4, 'Social Studies', 'SOS-PRY', 1);
INSERT INTO public.subjects VALUES (21, 'QURAN', 'QUR-PRY', 1);
INSERT INTO public.subjects VALUES (38, 'PHYSICS', 'PHY-SEC', 12);
INSERT INTO public.subjects VALUES (18, 'PHYSICAL AND HEALTH EDUCATION', 'PHE-PRY', 1);
INSERT INTO public.subjects VALUES (53, 'MATHS', 'MATHS-SEC 1', 9);
INSERT INTO public.subjects VALUES (36, 'MATHEMATICS', 'MATHS-SEC', 12);
INSERT INTO public.subjects VALUES (1, 'Mathematics', 'MTH-PRY', 1);
INSERT INTO public.subjects VALUES (47, 'MARKETING', 'MKT-SEC', 12);
INSERT INTO public.subjects VALUES (51, 'LITERATURE-IN-ENGLISH', 'LIT-SEC', 12);
INSERT INTO public.subjects VALUES (11, 'Islamic Studies', 'IRS-PRY', 1);
INSERT INTO public.subjects VALUES (50, 'IRS', 'IRS-SEC 2', 12);
INSERT INTO public.subjects VALUES (15, 'HOME ECONOMICS', 'H/ECONS-PRY', 1);
INSERT INTO public.subjects VALUES (9, 'Computer Studies', 'ICT-PRY', 1);
INSERT INTO public.subjects VALUES (27, 'CCA', 'CCA-PRY1', 1);
INSERT INTO public.subjects VALUES (17, 'CREATIVE AND CULTURAL ARTS', 'CCA-PRY2', 2);
INSERT INTO public.subjects VALUES (46, 'DATA PROCESSING', 'DATA PRO-SEC', 12);
INSERT INTO public.subjects VALUES (43, 'ECONOMICS', 'ECONS-SEC', 12);
INSERT INTO public.subjects VALUES (35, 'ENGLISH LANGUAGE', 'ENG-SEC', 13);
INSERT INTO public.subjects VALUES (52, 'ENGLISH STDS', 'ENG-SEC 1', 9);
INSERT INTO public.subjects VALUES (2, 'ENGLISH STUDIES', 'ENG-PRY1', 1);
INSERT INTO public.subjects VALUES (44, 'FINANCIAL ACCOUNT', 'F/ACC-SEC', 12);
INSERT INTO public.subjects VALUES (40, 'FURTHER MATHS', 'F/MATHS-SEC', 12);
INSERT INTO public.subjects VALUES (19, 'HANDWRITING', 'H/W-PRY', 1);
INSERT INTO public.subjects VALUES (42, 'CIVIC EDUCATION', 'CIV-SEC 2', 12);
INSERT INTO public.subjects VALUES (55, 'CIVIC EDUCATION', 'CIV-SEC 1', 9);
INSERT INTO public.subjects VALUES (57, 'AGRIC SCIENCE', 'AGRIC-SEC 1', 9);
INSERT INTO public.subjects VALUES (69, 'ARABIC STUDIES', 'ARA-SEC 1', 9);
INSERT INTO public.subjects VALUES (67, 'YORUBA LANGUAGE', 'YOR-SEC 1', 9);
INSERT INTO public.subjects VALUES (70, 'QURAN STDS', 'QUR-SEC 1', 9);
INSERT INTO public.subjects VALUES (59, 'PHE', 'PHE-SEC 1', 9);
INSERT INTO public.subjects VALUES (68, 'ICT', 'ICT-SEC 1', 9);
INSERT INTO public.subjects VALUES (58, 'HOME ECONS', 'H/ECONS-SEC1', 9);
INSERT INTO public.subjects VALUES (66, 'CREATICE AND CULTURAL A', 'CCA-SEC 1', 9);


--
-- TOC entry 3505 (class 0 OID 16485)
-- Dependencies: 221
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: sna_db_user
--

INSERT INTO public.users VALUES (30, 'Sumayah ', 'sumayahabdulateef@gmail.com', '$2b$10$8IyalW0LnyVweGKNHzOETOan4mU3PxXoQ5afnCvz.6AKhGjJsoGNu', '2025-06-28 01:09:19.44472', false, 'teacher', NULL, NULL, NULL, 'https://res.cloudinary.com/dyphku0jr/image/upload/v1750662670/default_avatar_sjvhgm.jpg', NULL, NULL, NULL, NULL, NULL, 'Sumayah Abdlateef ', NULL, NULL);
INSERT INTO public.users VALUES (24, 'Abdullah', 'ishola2023m@gmail.com', '$2a$12$h.RUBmgfYfZt26GcKdznLOyvjaTKeFn1TZn.q88PTmwnHKQoObeJO', '2025-06-23 21:08:49.757274', true, 'admin', NULL, 'Abdullah', 'Abdlateef', NULL, NULL, 'male', NULL, NULL, '$2a$12$h.RUBmgfYfZt26GcKdznLOyvjaTKeFn1TZn.q88PTmwnHKQoObeJO', NULL, NULL, NULL);
INSERT INTO public.users VALUES (1, 'Abu Sumayah', 'sealednec@gmail.com', '$2a$12$JJV.7X.ZgUZIYFqPfhoZl.Ih2swTcjfB7MpS7wdZ.4Cwoyh3RtONC', '2025-06-01 22:42:59.865333', true, 'admin', NULL, 'Abu', 'Sumayah', NULL, NULL, 'Male', '2025-06-22 04:45:50.331474', NULL, '$2a$12$JJV.7X.ZgUZIYFqPfhoZl.Ih2swTcjfB7MpS7wdZ.4Cwoyh3RtONC', NULL, NULL, NULL);
INSERT INTO public.users VALUES (32, 'Maryam', 'aba@gmail.com', '$2b$10$631oNypGpOXukmDdqszX3uE5qQ3RUL.8Ot3TpHVhLWn4KiUjB1UTS', '2025-07-07 23:03:13.795242', false, 'student', 'SNA/25/001', NULL, NULL, 'https://res.cloudinary.com/dyphku0jr/image/upload/v1750662670/default_avatar_sjvhgm.jpg', '2020-07-05', 'Female', '2025-07-08 13:29:02.963451', 1, NULL, NULL, NULL, NULL);
INSERT INTO public.users VALUES (15, 'khadijah', 'abdlateefkhadijah@gmail.com', '$2b$10$zQG388LFxfkrRXEjfDThB.Y.NoWjQYzyjJPK1oKXkquL0RFiVWKKW', '2025-06-05 15:22:56.261559', false, 'teacher', NULL, 'khadijah', 'Abdlateef', 'https://res.cloudinary.com/dyphku0jr/image/upload/v1750662670/default_avatar_sjvhgm.jpg', NULL, NULL, '2025-07-08 18:37:36.797822', NULL, '$2b$10$2NGHTnaRfVUVb98EOBYpROxxGXvUPf9xN.4FX2MeTybqueuDMYU6G', 'Khadijah abdlateef ', NULL, NULL);


--
-- TOC entry 3537 (class 0 OID 0)
-- Dependencies: 216
-- Name: classes_class_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sna_db_user
--

SELECT pg_catalog.setval('public.classes_class_id_seq', 14, true);


--
-- TOC entry 3538 (class 0 OID 0)
-- Dependencies: 225
-- Name: classes_class_id_seq1; Type: SEQUENCE SET; Schema: public; Owner: sna_db_user
--

SELECT pg_catalog.setval('public.classes_class_id_seq1', 11, true);


--
-- TOC entry 3539 (class 0 OID 0)
-- Dependencies: 235
-- Name: exam_results_result_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sna_db_user
--

SELECT pg_catalog.setval('public.exam_results_result_id_seq', 3, true);


--
-- TOC entry 3540 (class 0 OID 0)
-- Dependencies: 229
-- Name: exam_sections_section_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sna_db_user
--

SELECT pg_catalog.setval('public.exam_sections_section_id_seq', 9, true);


--
-- TOC entry 3541 (class 0 OID 0)
-- Dependencies: 233
-- Name: exam_sessions_session_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sna_db_user
--

SELECT pg_catalog.setval('public.exam_sessions_session_id_seq', 3, true);


--
-- TOC entry 3542 (class 0 OID 0)
-- Dependencies: 227
-- Name: exams_exam_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sna_db_user
--

SELECT pg_catalog.setval('public.exams_exam_id_seq', 7, true);


--
-- TOC entry 3543 (class 0 OID 0)
-- Dependencies: 231
-- Name: questions_question_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sna_db_user
--

SELECT pg_catalog.setval('public.questions_question_id_seq', 23, true);


--
-- TOC entry 3544 (class 0 OID 0)
-- Dependencies: 218
-- Name: report_card_meta_report_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sna_db_user
--

SELECT pg_catalog.setval('public.report_card_meta_report_id_seq', 1, true);


--
-- TOC entry 3545 (class 0 OID 0)
-- Dependencies: 223
-- Name: results_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sna_db_user
--

SELECT pg_catalog.setval('public.results_id_seq', 1, false);


--
-- TOC entry 3546 (class 0 OID 0)
-- Dependencies: 220
-- Name: subjects_subject_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sna_db_user
--

SELECT pg_catalog.setval('public.subjects_subject_id_seq', 70, true);


--
-- TOC entry 3547 (class 0 OID 0)
-- Dependencies: 222
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: sna_db_user
--

SELECT pg_catalog.setval('public.users_id_seq', 32, true);


--
-- TOC entry 3318 (class 2606 OID 16758)
-- Name: classes classes_class_code_key; Type: CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_class_code_key UNIQUE (class_code);


--
-- TOC entry 3320 (class 2606 OID 16760)
-- Name: classes classes_name_key; Type: CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_name_key UNIQUE (name);


--
-- TOC entry 3292 (class 2606 OID 16504)
-- Name: class_levels classes_pkey; Type: CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.class_levels
    ADD CONSTRAINT classes_pkey PRIMARY KEY (level_id);


--
-- TOC entry 3322 (class 2606 OID 16677)
-- Name: classes classes_pkey1; Type: CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_pkey1 PRIMARY KEY (class_id);


--
-- TOC entry 3332 (class 2606 OID 16928)
-- Name: exam_results exam_results_pkey; Type: CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.exam_results
    ADD CONSTRAINT exam_results_pkey PRIMARY KEY (result_id);


--
-- TOC entry 3326 (class 2606 OID 16878)
-- Name: exam_sections exam_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.exam_sections
    ADD CONSTRAINT exam_sections_pkey PRIMARY KEY (section_id);


--
-- TOC entry 3330 (class 2606 OID 16912)
-- Name: exam_sessions exam_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.exam_sessions
    ADD CONSTRAINT exam_sessions_pkey PRIMARY KEY (session_id);


--
-- TOC entry 3324 (class 2606 OID 16869)
-- Name: exams exams_pkey; Type: CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.exams
    ADD CONSTRAINT exams_pkey PRIMARY KEY (exam_id);


--
-- TOC entry 3328 (class 2606 OID 16893)
-- Name: questions questions_pkey; Type: CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_pkey PRIMARY KEY (question_id);


--
-- TOC entry 3298 (class 2606 OID 16514)
-- Name: report_card_meta report_card_meta_pkey; Type: CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.report_card_meta
    ADD CONSTRAINT report_card_meta_pkey PRIMARY KEY (report_id);


--
-- TOC entry 3300 (class 2606 OID 16762)
-- Name: report_card_meta report_card_meta_student_id_term_session_key; Type: CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.report_card_meta
    ADD CONSTRAINT report_card_meta_student_id_term_session_key UNIQUE (student_id, term, session);


--
-- TOC entry 3316 (class 2606 OID 16609)
-- Name: results results_pkey; Type: CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.results
    ADD CONSTRAINT results_pkey PRIMARY KEY (id);


--
-- TOC entry 3302 (class 2606 OID 16520)
-- Name: subjects subjects_pkey; Type: CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT subjects_pkey PRIMARY KEY (subject_id);


--
-- TOC entry 3304 (class 2606 OID 16766)
-- Name: subjects subjects_subject_code_key; Type: CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT subjects_subject_code_key UNIQUE (subject_code);


--
-- TOC entry 3294 (class 2606 OID 16768)
-- Name: class_levels unique_level_code; Type: CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.class_levels
    ADD CONSTRAINT unique_level_code UNIQUE (level_code);


--
-- TOC entry 3296 (class 2606 OID 16770)
-- Name: class_levels unique_level_name; Type: CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.class_levels
    ADD CONSTRAINT unique_level_name UNIQUE (level_name);


--
-- TOC entry 3334 (class 2606 OID 16973)
-- Name: exam_results unique_student_exam; Type: CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.exam_results
    ADD CONSTRAINT unique_student_exam UNIQUE (student_id, exam_id);


--
-- TOC entry 3306 (class 2606 OID 16975)
-- Name: subjects unique_subject_code_per_class_level; Type: CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT unique_subject_code_per_class_level UNIQUE (subject_code, class_level_id);


--
-- TOC entry 3308 (class 2606 OID 16776)
-- Name: users users_admission_number_key; Type: CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_admission_number_key UNIQUE (admission_number);


--
-- TOC entry 3310 (class 2606 OID 16778)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 3312 (class 2606 OID 16532)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 3314 (class 2606 OID 16780)
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- TOC entry 3335 (class 2606 OID 16781)
-- Name: class_levels classes_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.class_levels
    ADD CONSTRAINT classes_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.users(id);


--
-- TOC entry 3354 (class 2606 OID 16929)
-- Name: exam_results exam_results_exam_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.exam_results
    ADD CONSTRAINT exam_results_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.exams(exam_id) ON DELETE CASCADE;


--
-- TOC entry 3348 (class 2606 OID 16879)
-- Name: exam_sections exam_sections_exam_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.exam_sections
    ADD CONSTRAINT exam_sections_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.exams(exam_id) ON DELETE CASCADE;


--
-- TOC entry 3352 (class 2606 OID 16913)
-- Name: exam_sessions exam_sessions_exam_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.exam_sessions
    ADD CONSTRAINT exam_sessions_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.exams(exam_id) ON DELETE CASCADE;


--
-- TOC entry 3337 (class 2606 OID 16821)
-- Name: subjects exams_subject_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT exams_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(subject_id);


--
-- TOC entry 3340 (class 2606 OID 16615)
-- Name: users fk_class; Type: FK CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT fk_class FOREIGN KEY (class_level_id) REFERENCES public.class_levels(level_id) ON DELETE SET NULL;


--
-- TOC entry 3338 (class 2606 OID 16663)
-- Name: subjects fk_class_level; Type: FK CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT fk_class_level FOREIGN KEY (class_level_id) REFERENCES public.class_levels(level_id) ON DELETE RESTRICT;


--
-- TOC entry 3341 (class 2606 OID 16688)
-- Name: users fk_class_level; Type: FK CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT fk_class_level FOREIGN KEY (class_level_id) REFERENCES public.class_levels(level_id) ON DELETE RESTRICT;


--
-- TOC entry 3345 (class 2606 OID 16939)
-- Name: exams fk_class_level; Type: FK CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.exams
    ADD CONSTRAINT fk_class_level FOREIGN KEY (class_level_id) REFERENCES public.class_levels(level_id) ON DELETE RESTRICT;


--
-- TOC entry 3346 (class 2606 OID 16944)
-- Name: exams fk_created_by; Type: FK CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.exams
    ADD CONSTRAINT fk_created_by FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 3355 (class 2606 OID 16954)
-- Name: exam_results fk_student_id_result; Type: FK CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.exam_results
    ADD CONSTRAINT fk_student_id_result FOREIGN KEY (student_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3347 (class 2606 OID 16934)
-- Name: exams fk_subject; Type: FK CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.exams
    ADD CONSTRAINT fk_subject FOREIGN KEY (subject_id) REFERENCES public.subjects(subject_id) ON DELETE RESTRICT;


--
-- TOC entry 3339 (class 2606 OID 16740)
-- Name: subjects fk_subjects_class_level; Type: FK CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT fk_subjects_class_level FOREIGN KEY (class_level_id) REFERENCES public.class_levels(level_id) ON DELETE RESTRICT;


--
-- TOC entry 3349 (class 2606 OID 16959)
-- Name: questions fk_user_id_question; Type: FK CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT fk_user_id_question FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3353 (class 2606 OID 16949)
-- Name: exam_sessions fk_user_id_session; Type: FK CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.exam_sessions
    ADD CONSTRAINT fk_user_id_session FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3342 (class 2606 OID 16745)
-- Name: users fk_users_class_level; Type: FK CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT fk_users_class_level FOREIGN KEY (class_level_id) REFERENCES public.class_levels(level_id) ON DELETE SET NULL;


--
-- TOC entry 3350 (class 2606 OID 16894)
-- Name: questions questions_exam_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.exams(exam_id) ON DELETE CASCADE;


--
-- TOC entry 3351 (class 2606 OID 16899)
-- Name: questions questions_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.exam_sections(section_id) ON DELETE CASCADE;


--
-- TOC entry 3336 (class 2606 OID 16836)
-- Name: report_card_meta report_card_meta_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.report_card_meta
    ADD CONSTRAINT report_card_meta_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 3344 (class 2606 OID 16841)
-- Name: results results_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.results
    ADD CONSTRAINT results_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- TOC entry 3343 (class 2606 OID 16846)
-- Name: users users_class_level_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: sna_db_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_class_level_id_fkey FOREIGN KEY (class_level_id) REFERENCES public.class_levels(level_id) ON DELETE SET NULL;


--
-- TOC entry 2090 (class 826 OID 16391)
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: -; Owner: postgres
--

-- ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT ALL ON SEQUENCES TO sna_db_user;


--
-- TOC entry 2092 (class 826 OID 16393)
-- Name: DEFAULT PRIVILEGES FOR TYPES; Type: DEFAULT ACL; Schema: -; Owner: postgres
--

-- ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT ALL ON TYPES TO sna_db_user;


--
-- TOC entry 2091 (class 826 OID 16392)
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: -; Owner: postgres
--

-- ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT ALL ON FUNCTIONS TO sna_db_user;


--
-- TOC entry 2089 (class 826 OID 16390)
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: -; Owner: postgres
--

-- ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO sna_db_user;


-- Completed on 2025-07-08 22:04:06

--
-- PostgreSQL database dump complete
--

