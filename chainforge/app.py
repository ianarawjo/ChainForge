import argparse
from chainforge.flask_app import run_server

# Main Chainforge start
def main():
    parser = argparse.ArgumentParser(description='Chainforge command line tool')

    # Serve command
    subparsers = parser.add_subparsers(dest='serve')
    serve_parser = subparsers.add_parser('serve', help='Start Chainforge server')

    # TODO: Add this back
    # Turn on to disable all outbound LLM API calls and replace them with dummy calls
    # that return random strings of ASCII characters. Useful for testing interface without wasting $$.
    # serve_parser.add_argument('--dummy-responses', 
    #     help="""Disables queries to LLMs, replacing them with spoofed responses composed of random ASCII characters. 
    #             Produces each dummy response at random intervals between 0.1 and 3 seconds.""", 
    #     dest='dummy_responses', 
    #     action='store_true')
    
    # TODO: Reimplement this where the React server is given the backend's port before loading.
    serve_parser.add_argument('--port', 
                              help='The port to run the server on. Defaults to 8000.', 
                              type=int, default=8000, nargs='?')
    serve_parser.add_argument('--host', 
                              help="The host to run the server on. Defaults to 'localhost'.", 
                              type=str, default="localhost", nargs='?')

    args = parser.parse_args()

    # Currently only support the 'serve' command...
    if not args.serve:
        parser.print_help()
        exit(0)
    
    port = args.port if args.port else 8000
    host = args.host if args.host else "localhost" 

    print(f"Serving Flask server on {host} on port {port}...")
    run_server(host=host, port=port, cmd_args=args)

if __name__ == "__main__":
    main()