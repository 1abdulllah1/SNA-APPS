--
-- PostgreSQL database dump
--

-- Dumped from database version 17.2
-- Dumped by pg_dump version 17.2

-- Started on 2025-06-29 10:48:49

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 239 (class 1255 OID 49518)
-- Name: trigger_set_timestamp(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.trigger_set_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.trigger_set_timestamp() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 228 (class 1259 OID 32980)
-- Name: class_levels; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.class_levels (
    level_id integer NOT NULL,
    level_name character varying(50) NOT NULL,
    teacher_id integer,
    level_code character varying(255)
);


ALTER TABLE public.class_levels OWNER TO postgres;

--
-- TOC entry 238 (class 1259 OID 90468)
-- Name: classes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.classes (
    class_id integer NOT NULL,
    name character varying(100) NOT NULL,
    class_code character varying(50) NOT NULL,
    level integer NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.classes OWNER TO postgres;

--
-- TOC entry 227 (class 1259 OID 32979)
-- Name: classes_class_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.classes_class_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.classes_class_id_seq OWNER TO postgres;

--
-- TOC entry 4966 (class 0 OID 0)
-- Dependencies: 227
-- Name: classes_class_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.classes_class_id_seq OWNED BY public.class_levels.level_id;


--
-- TOC entry 237 (class 1259 OID 90467)
-- Name: classes_class_id_seq1; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.classes_class_id_seq1
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.classes_class_id_seq1 OWNER TO postgres;

--
-- TOC entry 4967 (class 0 OID 0)
-- Dependencies: 237
-- Name: classes_class_id_seq1; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.classes_class_id_seq1 OWNED BY public.classes.class_id;


--
-- TOC entry 226 (class 1259 OID 32957)
-- Name: exam_results; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.exam_results OWNER TO postgres;

--
-- TOC entry 225 (class 1259 OID 32956)
-- Name: exam_results_result_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.exam_results_result_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.exam_results_result_id_seq OWNER TO postgres;

--
-- TOC entry 4969 (class 0 OID 0)
-- Dependencies: 225
-- Name: exam_results_result_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.exam_results_result_id_seq OWNED BY public.exam_results.result_id;


--
-- TOC entry 236 (class 1259 OID 82274)
-- Name: exam_sections; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.exam_sections (
    section_id integer NOT NULL,
    exam_id integer NOT NULL,
    section_order integer NOT NULL,
    title character varying(255) NOT NULL,
    instructions text,
    section_instructions text
);


ALTER TABLE public.exam_sections OWNER TO postgres;

--
-- TOC entry 235 (class 1259 OID 82273)
-- Name: exam_sections_section_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.exam_sections_section_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.exam_sections_section_id_seq OWNER TO postgres;

--
-- TOC entry 4971 (class 0 OID 0)
-- Dependencies: 235
-- Name: exam_sections_section_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.exam_sections_section_id_seq OWNED BY public.exam_sections.section_id;


--
-- TOC entry 224 (class 1259 OID 32940)
-- Name: exam_sessions; Type: TABLE; Schema: public; Owner: postgres
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
    time_remaining_seconds integer
);


ALTER TABLE public.exam_sessions OWNER TO postgres;

--
-- TOC entry 223 (class 1259 OID 32939)
-- Name: exam_sessions_session_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.exam_sessions_session_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.exam_sessions_session_id_seq OWNER TO postgres;

--
-- TOC entry 4973 (class 0 OID 0)
-- Dependencies: 223
-- Name: exam_sessions_session_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.exam_sessions_session_id_seq OWNED BY public.exam_sessions.session_id;


--
-- TOC entry 220 (class 1259 OID 32912)
-- Name: exams; Type: TABLE; Schema: public; Owner: postgres
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
    CONSTRAINT exams_exam_type_check CHECK (((exam_type)::text = ANY ((ARRAY['CA1'::character varying, 'CA2'::character varying, 'CA3'::character varying, 'CA4'::character varying, 'MID_TERM'::character varying, 'MAIN_EXAM'::character varying, 'OTHER_CA'::character varying])::text[]))),
    CONSTRAINT exams_term_check CHECK (((term)::text = ANY ((ARRAY['FIRST'::character varying, 'SECOND'::character varying, 'THIRD'::character varying])::text[])))
);


ALTER TABLE public.exams OWNER TO postgres;

--
-- TOC entry 219 (class 1259 OID 32911)
-- Name: exams_exam_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.exams_exam_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.exams_exam_id_seq OWNER TO postgres;

--
-- TOC entry 4975 (class 0 OID 0)
-- Dependencies: 219
-- Name: exams_exam_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.exams_exam_id_seq OWNED BY public.exams.exam_id;


--
-- TOC entry 222 (class 1259 OID 32926)
-- Name: questions; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.questions OWNER TO postgres;

--
-- TOC entry 221 (class 1259 OID 32925)
-- Name: questions_question_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.questions_question_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.questions_question_id_seq OWNER TO postgres;

--
-- TOC entry 4977 (class 0 OID 0)
-- Dependencies: 221
-- Name: questions_question_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.questions_question_id_seq OWNED BY public.questions.question_id;


--
-- TOC entry 232 (class 1259 OID 49501)
-- Name: report_card_meta; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.report_card_meta OWNER TO postgres;

--
-- TOC entry 231 (class 1259 OID 49500)
-- Name: report_card_meta_report_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.report_card_meta_report_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.report_card_meta_report_id_seq OWNER TO postgres;

--
-- TOC entry 4979 (class 0 OID 0)
-- Dependencies: 231
-- Name: report_card_meta_report_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.report_card_meta_report_id_seq OWNED BY public.report_card_meta.report_id;


--
-- TOC entry 234 (class 1259 OID 57693)
-- Name: results; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.results (
    id integer NOT NULL,
    user_id integer,
    score integer,
    total integer,
    submitted_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.results OWNER TO postgres;

--
-- TOC entry 233 (class 1259 OID 57692)
-- Name: results_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.results_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.results_id_seq OWNER TO postgres;

--
-- TOC entry 4981 (class 0 OID 0)
-- Dependencies: 233
-- Name: results_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.results_id_seq OWNED BY public.results.id;


--
-- TOC entry 230 (class 1259 OID 33039)
-- Name: subjects; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.subjects (
    subject_id integer NOT NULL,
    name character varying(255) NOT NULL,
    subject_code character varying(50),
    class_level text,
    class_level_id integer
);


ALTER TABLE public.subjects OWNER TO postgres;

--
-- TOC entry 229 (class 1259 OID 33038)
-- Name: subjects_subject_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.subjects_subject_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.subjects_subject_id_seq OWNER TO postgres;

--
-- TOC entry 4983 (class 0 OID 0)
-- Dependencies: 229
-- Name: subjects_subject_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.subjects_subject_id_seq OWNED BY public.subjects.subject_id;


--
-- TOC entry 218 (class 1259 OID 32898)
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
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
    class_level character varying(50),
    first_name character varying(255),
    last_name character varying(255),
    profile_picture_url text,
    dob date,
    gender character varying(10),
    updated_at timestamp without time zone,
    class_level_id integer,
    password_hash character varying(255),
    full_name character varying(255),
    CONSTRAINT class_level_for_students_only CHECK (((((role)::text = 'student'::text) AND (class_level IS NOT NULL) AND ((class_level)::text <> ''::text)) OR (((role)::text <> 'student'::text) AND (class_level IS NULL))))
);


ALTER TABLE public.users OWNER TO postgres;

--
-- TOC entry 217 (class 1259 OID 32897)
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- TOC entry 4985 (class 0 OID 0)
-- Dependencies: 217
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- TOC entry 4710 (class 2604 OID 32983)
-- Name: class_levels level_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.class_levels ALTER COLUMN level_id SET DEFAULT nextval('public.classes_class_id_seq'::regclass);


--
-- TOC entry 4718 (class 2604 OID 90471)
-- Name: classes class_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.classes ALTER COLUMN class_id SET DEFAULT nextval('public.classes_class_id_seq1'::regclass);


--
-- TOC entry 4707 (class 2604 OID 32960)
-- Name: exam_results result_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exam_results ALTER COLUMN result_id SET DEFAULT nextval('public.exam_results_result_id_seq'::regclass);


--
-- TOC entry 4717 (class 2604 OID 82277)
-- Name: exam_sections section_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exam_sections ALTER COLUMN section_id SET DEFAULT nextval('public.exam_sections_section_id_seq'::regclass);


--
-- TOC entry 4706 (class 2604 OID 32943)
-- Name: exam_sessions session_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exam_sessions ALTER COLUMN session_id SET DEFAULT nextval('public.exam_sessions_session_id_seq'::regclass);


--
-- TOC entry 4697 (class 2604 OID 32915)
-- Name: exams exam_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exams ALTER COLUMN exam_id SET DEFAULT nextval('public.exams_exam_id_seq'::regclass);


--
-- TOC entry 4704 (class 2604 OID 32929)
-- Name: questions question_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.questions ALTER COLUMN question_id SET DEFAULT nextval('public.questions_question_id_seq'::regclass);


--
-- TOC entry 4712 (class 2604 OID 49504)
-- Name: report_card_meta report_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.report_card_meta ALTER COLUMN report_id SET DEFAULT nextval('public.report_card_meta_report_id_seq'::regclass);


--
-- TOC entry 4715 (class 2604 OID 57696)
-- Name: results id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.results ALTER COLUMN id SET DEFAULT nextval('public.results_id_seq'::regclass);


--
-- TOC entry 4711 (class 2604 OID 33042)
-- Name: subjects subject_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subjects ALTER COLUMN subject_id SET DEFAULT nextval('public.subjects_subject_id_seq'::regclass);


--
-- TOC entry 4693 (class 2604 OID 32901)
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- TOC entry 4948 (class 0 OID 32980)
-- Dependencies: 228
-- Data for Name: class_levels; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.class_levels VALUES (2, 'primary 1', NULL, 'PRY 1');
INSERT INTO public.class_levels VALUES (3, 'primary 2', NULL, 'PRY 2');
INSERT INTO public.class_levels VALUES (4, 'primary 3', NULL, 'PRY 3');
INSERT INTO public.class_levels VALUES (6, 'primary 4', NULL, 'PRY 4');
INSERT INTO public.class_levels VALUES (7, 'primary 5', NULL, 'PRY 5');
INSERT INTO public.class_levels VALUES (8, 'primary 6', NULL, 'PRY 6');
INSERT INTO public.class_levels VALUES (9, 'JSS ONE', NULL, 'JS 1');
INSERT INTO public.class_levels VALUES (10, 'JSS two', NULL, 'JS 2');
INSERT INTO public.class_levels VALUES (11, 'JSS THREE', NULL, 'JS 3');
INSERT INTO public.class_levels VALUES (12, 'SSS ONE', NULL, 'SS 1');
INSERT INTO public.class_levels VALUES (13, 'SSS two', NULL, 'SS 2');
INSERT INTO public.class_levels VALUES (14, 'SSS THREE', NULL, 'SS 3');


--
-- TOC entry 4958 (class 0 OID 90468)
-- Dependencies: 238
-- Data for Name: classes; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.classes VALUES (1, 'primary 1', 'PRY 1', 2, '2025-06-28 18:49:47.24479+01', '2025-06-28 18:49:47.24479+01');
INSERT INTO public.classes VALUES (2, 'primary 2', 'PRY 2', 3, '2025-06-28 18:50:06.014214+01', '2025-06-28 18:50:06.014214+01');
INSERT INTO public.classes VALUES (3, 'primary 3', 'PRY 3', 4, '2025-06-28 21:07:42.923367+01', '2025-06-28 21:07:42.923367+01');
INSERT INTO public.classes VALUES (5, 'primary 4', 'PRY 4', 6, '2025-06-28 21:08:04.397695+01', '2025-06-28 21:08:04.397695+01');
INSERT INTO public.classes VALUES (6, 'primary 5', 'PRY 5', 7, '2025-06-28 21:08:22.844493+01', '2025-06-28 21:08:22.844493+01');
INSERT INTO public.classes VALUES (7, 'primary 6', 'PRY 6', 8, '2025-06-28 21:08:36.012411+01', '2025-06-28 21:08:36.012411+01');
INSERT INTO public.classes VALUES (8, 'JSS 1', 'JSS 1', 9, '2025-06-28 21:08:55.644459+01', '2025-06-28 21:08:55.644459+01');
INSERT INTO public.classes VALUES (9, 'JSS 2', 'JSS 2', 10, '2025-06-28 21:09:22.970102+01', '2025-06-28 21:09:22.970102+01');
INSERT INTO public.classes VALUES (10, 'JSS 3', 'JSS 3', 11, '2025-06-28 21:09:44.38892+01', '2025-06-28 21:09:44.38892+01');
INSERT INTO public.classes VALUES (11, 'SS 1', 'SS 1', 12, '2025-06-28 21:09:56.983114+01', '2025-06-28 21:09:56.983114+01');
INSERT INTO public.classes VALUES (12, 'SS 2', 'SS 2', 13, '2025-06-28 21:10:12.403439+01', '2025-06-28 21:10:12.403439+01');
INSERT INTO public.classes VALUES (13, 'SS 3', 'SS 3', 14, '2025-06-28 21:10:26.010245+01', '2025-06-28 21:10:26.010245+01');


--
-- TOC entry 4946 (class 0 OID 32957)
-- Dependencies: 226
-- Data for Name: exam_results; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- TOC entry 4956 (class 0 OID 82274)
-- Dependencies: 236
-- Data for Name: exam_sections; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- TOC entry 4944 (class 0 OID 32940)
-- Dependencies: 224
-- Data for Name: exam_sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- TOC entry 4940 (class 0 OID 32912)
-- Dependencies: 220
-- Data for Name: exams; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- TOC entry 4942 (class 0 OID 32926)
-- Dependencies: 222
-- Data for Name: questions; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- TOC entry 4952 (class 0 OID 49501)
-- Dependencies: 232
-- Data for Name: report_card_meta; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- TOC entry 4954 (class 0 OID 57693)
-- Dependencies: 234
-- Data for Name: results; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- TOC entry 4950 (class 0 OID 33039)
-- Dependencies: 230
-- Data for Name: subjects; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.subjects VALUES (3, 'Basic Science', 'BSC', NULL, 2);
INSERT INTO public.subjects VALUES (10, 'Civic Education', 'CVE', NULL, 2);
INSERT INTO public.subjects VALUES (9, 'Computer Studies', 'CMP', NULL, 2);
INSERT INTO public.subjects VALUES (2, 'English Language', 'ENG', NULL, 2);
INSERT INTO public.subjects VALUES (11, 'Islamic Studies', 'IRS', NULL, 2);
INSERT INTO public.subjects VALUES (1, 'Mathematics', 'MTH', NULL, 2);
INSERT INTO public.subjects VALUES (4, 'Social Studies', 'SOS', NULL, 2);
INSERT INTO public.subjects VALUES (14, 'Basic Sciences', 'BST', NULL, 3);
INSERT INTO public.subjects VALUES (15, 'YORUBA', 'YBA', NULL, 3);
INSERT INTO public.subjects VALUES (16, 'Civics Education', 'CVC', NULL, 3);


--
-- TOC entry 4938 (class 0 OID 32898)
-- Dependencies: 218
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.users VALUES (21, 'Abdullah', 'ishola2023m@gmail.com', '$2a$12$6spMh7xn2WtlJ50FM/NXn.I3N/dEO8m8S7NUdNI1ayBgnaV6S/I3O', '2025-06-23 21:20:51.804027', true, 'admin', NULL, NULL, 'Abdullah', 'Abdlateef', NULL, NULL, 'male', NULL, NULL, '$2a$12$6spMh7xn2WtlJ50FM/NXn.I3N/dEO8m8S7NUdNI1ayBgnaV6S/I3O', NULL);
INSERT INTO public.users VALUES (1, 'Abu', 'sealednec@gmail.com', '$2b$10$LHkg.bwr7kRJclnpCLp/vejNXRscxKm4msJYXislY1lCstgN375GC', '2025-06-01 22:42:59.865333', true, 'admin', NULL, NULL, 'Abu', 'Sumayah', NULL, NULL, NULL, NULL, NULL, '$2a$12$q/AHL2NG8wI2TM/oEuRUBeL7ajIDrPY/ZviGM3M51o5gKKxDo/odm', NULL);
INSERT INTO public.users VALUES (15, 'khadijah', 'abdlateefkhadijah@gmail.com', '$2b$10$zQG388LFxfkrRXEjfDThB.Y.NoWjQYzyjJPK1oKXkquL0RFiVWKKW', '2025-06-05 15:22:56.261559', false, 'teacher', NULL, NULL, 'khadijah', 'Abdlateef', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO public.users VALUES (18, 'Atiyah', 'ijh@gmail.com', '$2b$10$f.DLWYaAzpbDyfCTPLVxzey4l2tnlDuAqZ6K4nobDzta82AQZie12', '2025-06-08 12:20:06.023402', false, 'student', 'SNA/22/001', 'Primary 1', 'Atiyah', 'Abdulateef', '/uploads/profile_pictures/vlcsnap-2024-08-15-11h01m09s313__2_-1750573932292-452447910.png', '2015-02-09', 'Female', '2025-06-29 08:24:17.926006', 6, '$2b$10$ZJCGIvKfDofcTwrnddYwgOeOgsAykdyS8osKbRBTzXWmvukromslm', 'Atiyah Abdulateef');


--
-- TOC entry 4986 (class 0 OID 0)
-- Dependencies: 227
-- Name: classes_class_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.classes_class_id_seq', 14, true);


--
-- TOC entry 4987 (class 0 OID 0)
-- Dependencies: 237
-- Name: classes_class_id_seq1; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.classes_class_id_seq1', 13, true);


--
-- TOC entry 4988 (class 0 OID 0)
-- Dependencies: 225
-- Name: exam_results_result_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.exam_results_result_id_seq', 5, true);


--
-- TOC entry 4989 (class 0 OID 0)
-- Dependencies: 235
-- Name: exam_sections_section_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.exam_sections_section_id_seq', 4, true);


--
-- TOC entry 4990 (class 0 OID 0)
-- Dependencies: 223
-- Name: exam_sessions_session_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.exam_sessions_session_id_seq', 20, true);


--
-- TOC entry 4991 (class 0 OID 0)
-- Dependencies: 219
-- Name: exams_exam_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.exams_exam_id_seq', 16, true);


--
-- TOC entry 4992 (class 0 OID 0)
-- Dependencies: 221
-- Name: questions_question_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.questions_question_id_seq', 79, true);


--
-- TOC entry 4993 (class 0 OID 0)
-- Dependencies: 231
-- Name: report_card_meta_report_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.report_card_meta_report_id_seq', 1, false);


--
-- TOC entry 4994 (class 0 OID 0)
-- Dependencies: 233
-- Name: results_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.results_id_seq', 1, false);


--
-- TOC entry 4995 (class 0 OID 0)
-- Dependencies: 229
-- Name: subjects_subject_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.subjects_subject_id_seq', 16, true);


--
-- TOC entry 4996 (class 0 OID 0)
-- Dependencies: 217
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 37, true);


--
-- TOC entry 4767 (class 2606 OID 90479)
-- Name: classes classes_class_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_class_code_key UNIQUE (class_code);


--
-- TOC entry 4769 (class 2606 OID 90477)
-- Name: classes classes_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_name_key UNIQUE (name);


--
-- TOC entry 4745 (class 2606 OID 32985)
-- Name: class_levels classes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.class_levels
    ADD CONSTRAINT classes_pkey PRIMARY KEY (level_id);


--
-- TOC entry 4771 (class 2606 OID 90475)
-- Name: classes classes_pkey1; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_pkey1 PRIMARY KEY (class_id);


--
-- TOC entry 4741 (class 2606 OID 32963)
-- Name: exam_results exam_results_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exam_results
    ADD CONSTRAINT exam_results_pkey PRIMARY KEY (result_id);


--
-- TOC entry 4763 (class 2606 OID 82283)
-- Name: exam_sections exam_sections_exam_id_section_order_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exam_sections
    ADD CONSTRAINT exam_sections_exam_id_section_order_key UNIQUE (exam_id, section_order);


--
-- TOC entry 4765 (class 2606 OID 82281)
-- Name: exam_sections exam_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exam_sections
    ADD CONSTRAINT exam_sections_pkey PRIMARY KEY (section_id);


--
-- TOC entry 4737 (class 2606 OID 32945)
-- Name: exam_sessions exam_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exam_sessions
    ADD CONSTRAINT exam_sessions_pkey PRIMARY KEY (session_id);


--
-- TOC entry 4733 (class 2606 OID 32919)
-- Name: exams exams_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exams
    ADD CONSTRAINT exams_pkey PRIMARY KEY (exam_id);


--
-- TOC entry 4735 (class 2606 OID 32933)
-- Name: questions questions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_pkey PRIMARY KEY (question_id);


--
-- TOC entry 4757 (class 2606 OID 49510)
-- Name: report_card_meta report_card_meta_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.report_card_meta
    ADD CONSTRAINT report_card_meta_pkey PRIMARY KEY (report_id);


--
-- TOC entry 4759 (class 2606 OID 49512)
-- Name: report_card_meta report_card_meta_student_id_term_session_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.report_card_meta
    ADD CONSTRAINT report_card_meta_student_id_term_session_key UNIQUE (student_id, term, session);


--
-- TOC entry 4761 (class 2606 OID 57699)
-- Name: results results_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.results
    ADD CONSTRAINT results_pkey PRIMARY KEY (id);


--
-- TOC entry 4751 (class 2606 OID 33046)
-- Name: subjects subjects_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT subjects_name_key UNIQUE (name);


--
-- TOC entry 4753 (class 2606 OID 33044)
-- Name: subjects subjects_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT subjects_pkey PRIMARY KEY (subject_id);


--
-- TOC entry 4755 (class 2606 OID 33048)
-- Name: subjects subjects_subject_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT subjects_subject_code_key UNIQUE (subject_code);


--
-- TOC entry 4747 (class 2606 OID 82299)
-- Name: class_levels unique_level_code; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.class_levels
    ADD CONSTRAINT unique_level_code UNIQUE (level_code);


--
-- TOC entry 4749 (class 2606 OID 82297)
-- Name: class_levels unique_level_name; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.class_levels
    ADD CONSTRAINT unique_level_name UNIQUE (level_name);


--
-- TOC entry 4743 (class 2606 OID 33020)
-- Name: exam_results unique_student_exam; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exam_results
    ADD CONSTRAINT unique_student_exam UNIQUE (student_id, exam_id);


--
-- TOC entry 4739 (class 2606 OID 41309)
-- Name: exam_sessions unique_user_exam_session; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exam_sessions
    ADD CONSTRAINT unique_user_exam_session UNIQUE (user_id, exam_id);


--
-- TOC entry 4725 (class 2606 OID 32978)
-- Name: users users_admission_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_admission_number_key UNIQUE (admission_number);


--
-- TOC entry 4727 (class 2606 OID 32910)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 4729 (class 2606 OID 32906)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 4731 (class 2606 OID 32908)
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- TOC entry 4791 (class 2620 OID 49519)
-- Name: exams set_exam_timestamp; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER set_exam_timestamp BEFORE UPDATE ON public.exams FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamp();


--
-- TOC entry 4786 (class 2606 OID 32986)
-- Name: class_levels classes_teacher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.class_levels
    ADD CONSTRAINT classes_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.users(id);


--
-- TOC entry 4783 (class 2606 OID 33079)
-- Name: exam_results exam_results_exam_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exam_results
    ADD CONSTRAINT exam_results_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.exams(exam_id) ON DELETE CASCADE;


--
-- TOC entry 4784 (class 2606 OID 82268)
-- Name: exam_results exam_results_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exam_results
    ADD CONSTRAINT exam_results_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4785 (class 2606 OID 33104)
-- Name: exam_results exam_results_user_id_fkey1; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exam_results
    ADD CONSTRAINT exam_results_user_id_fkey1 FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4790 (class 2606 OID 82284)
-- Name: exam_sections exam_sections_exam_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exam_sections
    ADD CONSTRAINT exam_sections_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.exams(exam_id) ON DELETE CASCADE;


--
-- TOC entry 4780 (class 2606 OID 33099)
-- Name: exam_sessions exam_sessions_exam_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exam_sessions
    ADD CONSTRAINT exam_sessions_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.exams(exam_id) ON DELETE CASCADE;


--
-- TOC entry 4781 (class 2606 OID 33094)
-- Name: exam_sessions exam_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exam_sessions
    ADD CONSTRAINT exam_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4782 (class 2606 OID 33089)
-- Name: exam_sessions exam_sessions_user_id_fkey1; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exam_sessions
    ADD CONSTRAINT exam_sessions_user_id_fkey1 FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4774 (class 2606 OID 82305)
-- Name: exams exams_class_level_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exams
    ADD CONSTRAINT exams_class_level_id_fkey FOREIGN KEY (class_level_id) REFERENCES public.class_levels(level_id) ON DELETE RESTRICT;


--
-- TOC entry 4775 (class 2606 OID 33012)
-- Name: exams exams_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exams
    ADD CONSTRAINT exams_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 4776 (class 2606 OID 33051)
-- Name: exams exams_subject_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.exams
    ADD CONSTRAINT exams_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(subject_id);


--
-- TOC entry 4772 (class 2606 OID 65884)
-- Name: users fk_class; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT fk_class FOREIGN KEY (class_level_id) REFERENCES public.class_levels(level_id) ON DELETE SET NULL;


--
-- TOC entry 4787 (class 2606 OID 82310)
-- Name: subjects fk_class_level; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT fk_class_level FOREIGN KEY (class_level_id) REFERENCES public.class_levels(level_id) ON DELETE RESTRICT;


--
-- TOC entry 4777 (class 2606 OID 82289)
-- Name: questions fk_section; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT fk_section FOREIGN KEY (section_id) REFERENCES public.exam_sections(section_id) ON DELETE CASCADE;


--
-- TOC entry 4778 (class 2606 OID 33074)
-- Name: questions questions_exam_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_exam_id_fkey FOREIGN KEY (exam_id) REFERENCES public.exams(exam_id) ON DELETE CASCADE;


--
-- TOC entry 4779 (class 2606 OID 33109)
-- Name: questions questions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.questions
    ADD CONSTRAINT questions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4788 (class 2606 OID 49513)
-- Name: report_card_meta report_card_meta_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.report_card_meta
    ADD CONSTRAINT report_card_meta_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4789 (class 2606 OID 57700)
-- Name: results results_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.results
    ADD CONSTRAINT results_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- TOC entry 4773 (class 2606 OID 82300)
-- Name: users users_class_level_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_class_level_id_fkey FOREIGN KEY (class_level_id) REFERENCES public.class_levels(level_id) ON DELETE SET NULL;


--
-- TOC entry 4964 (class 0 OID 0)
-- Dependencies: 228
-- Name: TABLE class_levels; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.class_levels TO sealed_nectar_academy;


--
-- TOC entry 4965 (class 0 OID 0)
-- Dependencies: 238
-- Name: TABLE classes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.classes TO sealed_nectar_academy;


--
-- TOC entry 4968 (class 0 OID 0)
-- Dependencies: 226
-- Name: TABLE exam_results; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.exam_results TO sealed_nectar_academy;


--
-- TOC entry 4970 (class 0 OID 0)
-- Dependencies: 236
-- Name: TABLE exam_sections; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.exam_sections TO sealed_nectar_academy;


--
-- TOC entry 4972 (class 0 OID 0)
-- Dependencies: 224
-- Name: TABLE exam_sessions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.exam_sessions TO sealed_nectar_academy;


--
-- TOC entry 4974 (class 0 OID 0)
-- Dependencies: 220
-- Name: TABLE exams; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.exams TO sealed_nectar_academy;


--
-- TOC entry 4976 (class 0 OID 0)
-- Dependencies: 222
-- Name: TABLE questions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.questions TO sealed_nectar_academy;


--
-- TOC entry 4978 (class 0 OID 0)
-- Dependencies: 232
-- Name: TABLE report_card_meta; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.report_card_meta TO sealed_nectar_academy;


--
-- TOC entry 4980 (class 0 OID 0)
-- Dependencies: 234
-- Name: TABLE results; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.results TO sealed_nectar_academy;


--
-- TOC entry 4982 (class 0 OID 0)
-- Dependencies: 230
-- Name: TABLE subjects; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.subjects TO sealed_nectar_academy;


--
-- TOC entry 4984 (class 0 OID 0)
-- Dependencies: 218
-- Name: TABLE users; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.users TO sealed_nectar_academy;


--
-- TOC entry 2095 (class 826 OID 32896)
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO sealed_nectar_academy;


-- Completed on 2025-06-29 10:48:52

--
-- PostgreSQL database dump complete
--

