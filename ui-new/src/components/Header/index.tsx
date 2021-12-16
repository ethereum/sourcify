import logoText from "../../assets/logoText.svg";
const Header = () => {
  return (
    <div className="my-4 mx">
      <img src={logoText} alt="Sourcify logo" className="max-h-8 md:max-h-10" />
    </div>
  );
};

export default Header;
